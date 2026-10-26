from typing import Any, Dict, List, Optional

import httpx

from app.config import settings
from app.core.cache import default_cache
from app.core.exceptions import (
    ConfigurationException,
    NotFoundException,
    PermissionDeniedException,
    ProviderException,
    RateLimitException,
    ValidationException,
)
from app.core.logging import logger
from app.schemas.agent import AgentConfiguration
from app.schemas.voice import VoiceModel


def map_agent_config_to_elevenlabs_payload(name: str, config: AgentConfiguration) -> Dict[str, Any]:
    """Map internal VoiceForge AgentConfiguration to ElevenLabs Conversational AI schema with natural human speech optimizations."""
    natural_speech_guidelines = (
        "### NATURAL CONVERSATIONAL SPEECH RULES\n"
        "- You are speaking live over an interactive phone/voice call. Speak naturally, warmly, and like a real human.\n"
        "- Keep every turn short, flowing, and conversational: 1 to 2 spoken sentences maximum.\n"
        "- Never recite long lists, bullet points, formatting symbols, or markdown. Speak smoothly without clutter.\n"
        "- Use natural conversational rhythm and friendly inflection.\n"
        "- Never sound like a robotic AI or say 'As an AI model'. You are a real conversational specialist.\n"
        "- Give the caller space to reply. Ask only one clear question at a time.\n"
    )

    INDIAN_LANGUAGES = {
        "hi": {
            "name": "Hindi",
            "native": "हिन्दी",
            "directive": "आप एक धाराप्रवाह, विनम्र और स्वाभाविक हिंदी भाषी वॉयस असिस्टेंट हैं। सभी बातचीत केवल शुद्ध, सरल और स्पष्ट हिंदी (Devanagari Hindi) में ही करें।",
            "welcome": "नमस्ते! {name} में आपका स्वागत है। आज मैं आपकी क्या सहायता कर सकता हूँ?",
            "fallback": "माफ़ कीजिये, मैं समझ नहीं पाया। क्या आप कृपया दोबारा कह सकते हैं?",
            "escalation": "मैं समझता हूँ। मैं आपकी कॉल तुरंत हमारे मानव प्रतिनिधि को ट्रांसफर कर रहा हूँ। कृपया लाइन पर बने रहें।",
            "triggers": ["इंसान से बात करनी है", "प्रतिनिधि", "कॉल ट्रांसफर", "कस्टमर केयर"],
        },
        "hi-en": {
            "name": "Hinglish",
            "native": "हिंग्लिश",
            "directive": "You are a bilingual, natural Indian conversational voice assistant speaking fluent Hinglish (a friendly, spoken blend of Hindi and English as commonly spoken in modern Indian phone conversations).",
            "welcome": "Namaste! Welcome to {name}. How can I assist you today?",
            "fallback": "Sorry, main theek se samajh nahi paya. Kya aap please repeat kar sakte hain?",
            "escalation": "Sure, main aapki call turant hamare human representative ko transfer kar raha hoon. Please hold kijiye.",
            "triggers": ["transfer call", "speak to human", "representative", "customer care"],
        },
        "ta": {
            "name": "Tamil",
            "native": "தமிழ்",
            "directive": "நீங்கள் ஒரு இயல்பான மற்றும் மரியாதையான தமிழ் பேசும் குரல் உதவியாளர். அனைத்து உரையாடல்களையும் சரளமான தமிழில் (Tamil) மட்டுமே நடத்தவும்.",
            "welcome": "வணக்கம்! {name} உங்களை வரவேற்கிறது. நான் உங்களுக்கு எவ்வாறு உதவ முடியும்?",
            "fallback": "மன்னிக்கவும், என்னால் புரிந்து கொள்ள முடியவில்லை. தயவுசெய்து மீண்டும் கூற முடியுமா?",
            "escalation": "நான் புரிந்துகொள்கிறேன். எங்கள் பிரதிநிதியுடன் உங்களை இணைக்கிறேன். தயவுசெய்து காத்திருக்கவும்.",
            "triggers": ["பிரதிநிதி", "கால் டிரான்ஸ்பர்", "வாடிக்கையாளர் சேவை"],
        },
        "te": {
            "name": "Telugu",
            "native": "తెలుగు",
            "directive": "మీరు సహజమైన మరియు మర్యాదపూర్వకమైన తెలుగు మాట్లాడే వాయిస్ అసిస్టెంట్. సంభాషణ అంతా స్వచ్ఛమైన, స్పష్టమైన తెలుగులో (Telugu) మాత్రమే నిర్వహించండి.",
            "welcome": "నమస్కారం! {name} కు స్వాగతం. నేను మీకు ఎలా సహాయం చేయగలను?",
            "fallback": "క్షమించండి, నాకు అర్థం కాలేదు. దయచేసి మళ్ళీ చెప్పగలరా?",
            "escalation": "నేను అర్థం చేసుకున్నాను. నేను వెంటనే మిమ్మల్ని మా ప్రతినిధితో కలుపుతాను. దయచేసి వేచి ఉండండి.",
            "triggers": ["ప్రతినిధి", "కాల్ బదిలీ", "కస్టమర్ కేర్"],
        },
        "bn": {
            "name": "Bengali",
            "native": "বাংলা",
            "directive": "আপনি একজন মার্জিত এবং সাবলীল বাংলাভাষী ভয়েস সহকারী। সমস্ত কথোপকথন স্পষ্ট এবং স্বাভাবিক বাংলায় (Bengali) পরিচালনা করুন।",
            "welcome": "নমস্কার! {name}-এ আপনাকে স্বাগতম। আমি আপনাকে কীভাবে সাহায্য করতে পারি?",
            "fallback": "দুঃখিত, আমি বুঝতে পারিনি। আপনি কি দয়া করে আবার বলবেন?",
            "escalation": "আমি বুঝতে পারছি। আমি আপনাকে অবিলম্বে আমাদের প্রতিনিধির সাথে সংযুক্ত করছি। অনুগ্রহ করে লাইনে থাকুন।",
            "triggers": ["প্রতিনিধি", "কল স্থানান্তর", "কাস্টমার কেয়ার"],
        },
        "mr": {
            "name": "Marathi",
            "native": "मराठी",
            "directive": "तुम्ही एक नम्र आणि अस्खलित मराठी भाषिक व्हॉईस असिस्टंट आहात. सर्व संभाषणे स्पष्ट आणि नैसर्गिक मराठीत (Marathi) करा.",
            "welcome": "नमस्कार! {name} मध्ये आपले स्वागत आहे. मी तुम्हाला कशी मदत करू शकतो?",
            "fallback": "क्षमस्व, मला समजले नाही. कृपया आपण पुन्हा सांगू शकता का?",
            "escalation": "मी समजतो. मी आपला कॉल त्वरित आमच्या मानवी प्रतिनिधीकडे ट्रान्सफर करत आहे. कृपया होल्ड करा.",
            "triggers": ["प्रतिनिधी", "कॉल ट्रान्सफर", "कस्टमर केअर"],
        },
        "gu": {
            "name": "Gujarati",
            "native": "ગુજરાતી",
            "directive": "તમે એક વિનમ્ર અને અસ્ખલિત ગુજરાતી ભાષી વોઈસ આસિસ્ટન્ટ છો. તમામ વાતચીત સહજ અને શુદ્ધ ગુજરાતીમાં (Gujarati) જ કરો.",
            "welcome": "નમસ્તે! {name} માં આપનું સ્વાગત છે. હું તમને કેવી રીતે મદદ કરી શકું?",
            "fallback": "માફ કરશો, હું સમજી શક્યો નથી. શું તમે કૃપા કરીને ફરીથી કહી શકો છો?",
            "escalation": "હું સમજું છું. હું તમારો કૉલ તરત જ અમારા પ્રતિનિધિ સાથે જોડી રહ્યો છું. કૃપા કરીને લાઇન પર રહો.",
            "triggers": ["પ્રતિનિધિ", "કૉલ ટ્રાન્સફર", "કસ્ટમર કેર"],
        },
        "kn": {
            "name": "Kannada",
            "native": "ಕನ್ನಡ",
            "directive": "ನೀವು ವಿನಮ್ರ ಮತ್ತು ನಿರರ್ಗಳ ಕನ್ನಡ ಮಾತನಾಡುವ ಧ್ವನಿ ಸಹಾಯಕರು. ಎಲ್ಲಾ ಸಂಭಾಷಣೆಗಳನ್ನು ಸರಳ ಮತ್ತು ಸ್ಪಷ್ಟ ಕನ್ನಡದಲ್ಲಿ (Kannada) ಮಾತ್ರ ನಡೆಸಿ.",
            "welcome": "ನಮಸ್ಕಾರ! {name} ಗೆ ಸುಸ್ವಾಗತ. ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?",
            "fallback": "ಕ್ಷಮಿಸಿ, ನನಗೆ ಅರ್ಥವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಹೇಳಬಹುದೇ?",
            "escalation": "ನಾನು ಅರ್ಥಮಾಡಿಕೊಂಡಿದ್ದೇನೆ. ನಾನು ನಿಮ್ಮನ್ನು ತಕ್ಷಣ ನಮ್ಮ ಪ್ರತಿನಿಧಿಯೊಂದಿಗೆ ಸಂಪರ್ಕಿಸುತ್ತೇನೆ. ದಯವಿಟ್ಟು ಲೈನ್‌ನಲ್ಲಿ ಇರಿ.",
            "triggers": ["ಪ್ರತಿನಿಧಿ", "ಕಾಲ್ ವರ್ಗಾವಣೆ", "ಗ್ರಾಹಕ ಸೇವೆ"],
        },
        "ml": {
            "name": "Malayalam",
            "native": "മലയാളം",
            "directive": "നിങ്ങൾ വിനയവും സ്വാഭാവികവുമായ മലയാളം സംസാരിക്കുന്ന വോയ്‌സ് അസിസ്റ്റന്റാണ്. എല്ലാ സംഭാഷണങ്ങളും തെളിഞ്ഞ മലയാളത്തിൽ (Malayalam) മാത്രം സംസാരിക്കുക.",
            "welcome": "നമസ്കാരം! {name}-ലേക്ക് സ്വാഗതം. എനിക്ക് എങ്ങനെ സഹായിക്കാനാകും?",
            "fallback": "ക്ഷമിക്കണം, എനിക്ക് മനസ്സിലായില്ല. ദയവായി വീണ്ടും പറയാമോ?",
            "escalation": "മനസ്സിലായി. ഞാൻ നിങ്ങളെ ഞങ്ങളുടെ പ്രതിനിധിയുമായി ബന്ധിപ്പിക്കാം. ദയവായി കാത്തിരിക്കുക.",
            "triggers": ["പ്രതിനിധി", "കോൾ ട്രാൻസ്ഫർ", "കസ്റ്റമർ കെയർ"],
        },
        "pa": {
            "name": "Punjabi",
            "native": "ਪੰਜਾਬੀ",
            "directive": "ਤੁਸੀਂ ਇੱਕ ਨਿਮਰ ਅਤੇ ਕੁਦਰਤੀ ਪੰਜਾਬੀ ਬੋਲਣ ਵਾਲੇ ਵੌਇਸ ਅਸਿਸਟੈਂਟ ਹੋ। ਸਾਰੀ ਗੱਲਬਾਤ ਸਪੱਸ਼ਟ ਅਤੇ ਮਿੱਠੀ ਪੰਜਾਬੀ (Punjabi) ਵਿੱਚ ਕਰੋ।",
            "welcome": "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! {name} ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ। ਮੈਂ ਤੁਹਾਡੀ ਕੀ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ?",
            "fallback": "ਮਾਫ਼ ਕਰਨਾ, ਮੈਨੂੰ ਸਮਝ ਨਹੀਂ ਆਇਆ। ਕੀ ਤੁਸੀਂ ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕਹਿ ਸਕਦੇ ਹੋ?",
            "escalation": "ਮੈਂ ਸਮਝਦਾ ਹਾਂ। ਮੈਂ ਤੁਹਾਡੀ ਕਾਲ ਤੁਰੰਤ ਸਾਡੇ ਪ੍ਰਤੀਨਿਧੀ ਨੂੰ ਟ੍ਰਾਂਸਫਰ ਕਰ ਰਿਹਾ ਹਾਂ। ਕਿਰਪਾ ਕਰਕੇ ਲਾਈਨ ਤੇ ਬਣੇ ਰਹੋ।",
            "triggers": ["ਪ੍ਰਤੀਨਿਧੀ", "ਕਾਲ ਟ੍ਰਾਂਸਫਰ", "ਕਸਟਮਰ ਕੇਅਰ"],
        },
        "or": {
            "name": "Odia",
            "native": "ଓଡ଼ିଆ",
            "directive": "ଆପଣ ଜଣେ ନମ୍ର ଏବଂ ସ୍ୱାଭାବିକ ଓଡ଼ିଆ ଭାଷୀ ଭଏସ୍ ସହାୟକ। ସମସ୍ତ ବାର୍ତ୍ତାଳାପ ସ୍ପଷ୍ଟ ଏବଂ ସରଳ ଓଡ଼ିଆରେ (Odia) କରନ୍ତୁ।",
            "welcome": "ନମସ୍କାର! {name} କୁ ସ୍ୱାଗତ। ମୁଁ ଆପଣଙ୍କୁ କିପରି ସାହାଯ୍ୟ କରିପାରିବି?",
            "fallback": "କ୍ଷମା କରିବେ, ମୁଁ ବୁଝିପାରିଲି ନାହିଁ। ଆପଣ ଦୟାକରି ପୁଣି କହିପାରିବେ କି?",
            "escalation": "ମୁଁ ବୁଝିପାରୁଛି। ମୁଁ ଆପଣଙ୍କ କଲ୍ ତୁରନ୍ତ ଆମ ପ୍ରତିନିଧିଙ୍କୁ ସଂଯୋଗ କରୁଛି। ଦୟାକରି ଲାଇନରେ ରୁହନ୍ତୁ।",
            "triggers": ["ପ୍ରତିନିଧି", "କଲ୍ ଟ୍ରାନ୍ସଫର", "ଗ୍ରାହକ ସେବା"],
        },
        "ur": {
            "name": "Urdu",
            "native": "اردو",
            "directive": "آپ ایک شائستہ اور فصیح اردو بولنے والے وائس اسسٹنٹ ہیں۔ تمام گفتگو نرم، شائستہ اور قدرتی اردو (Urdu) میں کریں۔",
            "welcome": "السلام علیکم! {name} میں خوش آمدید۔ میں آپ کی کیا مدد کر سکتا ہوں؟",
            "fallback": "معذرت، میں سمجھ نہیں پایا۔ کیا آپ برائے مہربانی دوبارہ فرما سکتے ہیں؟",
            "escalation": "میں سمجھتا ہوں۔ میں آپ کی کال فوری طور پر ہمارے نمائندے کو منتقل کر رہا ہوں۔ براہ کرم لائن پر رہیں۔",
            "triggers": ["نمائندہ", "کال ٹرانسفر", "کسٹمر کیئر"],
        },
        "as": {
            "name": "Assamese",
            "native": "অসমীয়া",
            "directive": "আপুনি এজন বিনম্ৰ আৰু প্ৰাকৃতিক অসমীয়া ভাষী ভইচ সহায়ক। সকলো বাৰ্তালাপ স্পষ্ট আৰু সৰল অসমীয়াত (Assamese) পৰিচালনা কৰক।",
            "welcome": "নমস্কাৰ! {name} লৈ স্বাগতম। মই আপোনাক কিদৰে সহায় কৰিব পাৰোঁ?",
            "fallback": "ক্ষমা কৰিব, মই বুজিব নোৱাৰিলোঁ। আপুনি অনুগ্ৰহ কৰি আকৌ ক’ব পাৰিবনে?",
            "escalation": "মই বুজি পাইছোঁ। মই আপোনাৰ কলটো আমাৰ প্ৰতিনিধিৰ সৈতে সংযোগ কৰি আছোঁ। অনুগ্ৰহ কৰি লাইনে থাকক।",
            "triggers": ["প্ৰতিনিধি", "কল স্থানান্তৰ", "গ্ৰাহক সেৱা"],
        },
        "ne": {
            "name": "Nepali",
            "native": "नेपाली",
            "directive": "तपाईं एक विनम्र र स्वाभाविक नेपाली भाषी भ्वाइस सहायक हुनुहुन्छ। सम्पूर्ण कुराकानी सरल, स्पष्ट र विनम्र नेपालीमा (Nepali) गर्नुहोस्।",
            "welcome": "नमस्ते! {name} मा स्वागत छ। म तपाईंलाई कसरी मद्दत गर्न सक्छु?",
            "fallback": "माफ गर्नुहोस्, मैले बुझिनँ। के तपाईं कृपया फेरि भन्न सक्नुहुन्छ?",
            "escalation": "म बुझ्दछु। म तपाईंको कल तुरुन्तै हाम्रो प्रतिनिधिमा स्थानान्तरण गर्दैछु। कृपया लाइनमा रहनुहोस्।",
            "triggers": ["प्रतिनिधि", "कल ट्रान्सफर", "ग्राहक सेवा"],
        },
    }

    lang_names = {
        "en": "English",
        "es": "Spanish",
        "fr": "French",
        "de": "German",
        "ja": "Japanese",
        "pt": "Portuguese",
        "it": "Italian",
        "ar": "Arabic",
        "zh": "Chinese",
        "nl": "Dutch",
        "ko": "Korean",
        "ru": "Russian",
        "tr": "Turkish",
        "pl": "Polish",
        "sv": "Swedish",
        "id": "Indonesian",
    }
    for code, info in INDIAN_LANGUAGES.items():
        lang_names[code] = f"{info['name']} ({info['native']})"

    lang_label = lang_names.get(config.language, config.language or "English")
    is_indian_lang = config.language in INDIAN_LANGUAGES
    indian_meta = INDIAN_LANGUAGES.get(config.language)

    def _localize_fallback(text: Optional[str], lang: str) -> Optional[str]:
        if not text:
            return text
        if is_indian_lang and indian_meta:
            low = text.lower()
            if any(w in low for w in ["repeat", "catch", "understand", "clarify", "pardon"]):
                return indian_meta["fallback"]
        return text

    if is_indian_lang and indian_meta:
        language_rule = (
            f"### CRITICAL LANGUAGE MANDATE - {indian_meta['name'].upper()} ({indian_meta['native']})\n"
            f"- {indian_meta['directive']}\n"
            f"- Speak naturally, respectfully, and with clear regional inflection.\n"
            f"- Understand caller speech in both native script and Romanized phonetics.\n"
            f"- Keep every response short and conversational (1 to 2 spoken sentences maximum).\n"
        )
        speech_guidelines = (
            f"### NATURAL REGIONAL SPEECH RULES ({indian_meta['name']})\n"
            "- You are on an interactive live telephone call. Speak at a calm, relaxed, and clear cadence.\n"
            "- Keep sentences short and easy to understand (1 to 2 sentences per turn).\n"
            "- Never recite bullet points, markdown symbols (*), or technical AI jargon.\n"
            "- Never say 'As an AI model'. You are an authentic human-like voice specialist.\n"
            "- Give the caller ample time to respond. Ask only one question at a time.\n"
        )
    elif config.language == "en":
        language_rule = (
            "### CRITICAL LANGUAGE MANDATE - ENGLISH ONLY\n"
            "- You must speak, listen, and answer strictly in English.\n"
            "- Do not speak in other languages.\n"
        )
        speech_guidelines = natural_speech_guidelines
    else:
        language_rule = (
            f"### CRITICAL LANGUAGE MANDATE - {lang_label.upper()} ONLY\n"
            f"- You must speak, listen, and answer strictly in {lang_label} ({config.language}).\n"
            f"- Do not switch to English. All responses must be delivered in fluent {lang_label}.\n"
        )
        speech_guidelines = natural_speech_guidelines

    prompt_sections = [
        language_rule,
        speech_guidelines,
        f"### ROLE & PURPOSE\n{config.instructions}\n",
        f"### PERSONALITY & SPEAKING STYLE\nTone: {config.personality.tone}\nSpeaking Style: {config.personality.speaking_style}\nPace: {config.personality.pace}\nTraits: {', '.join(config.personality.traits)}\n",
    ]

    if config.conversation_flow and config.conversation_flow.steps:
        flow_header = (
            f"### CONVERSATION FLOW - ({indian_meta['name']} Responses)"
            if is_indian_lang and indian_meta
            else "### CONVERSATION FLOW"
        )
        flow_lines = [flow_header]
        for step in config.conversation_flow.steps:
            phrases = ""
            if step.example_phrases:
                phrases = f" (Examples: {', '.join(step.example_phrases)})"
            fallback_text = _localize_fallback(step.fallback, config.language)
            fallback = f" Fallback: {fallback_text}" if fallback_text else ""
            flow_lines.append(
                f"- Step [{step.step_id}] '{step.title}': {step.goal}{phrases}{fallback}"
            )
        fb_policy = config.conversation_flow.fallback_policy or "Ask polite clarification if caller request is ambiguous."
        flow_lines.append(f"General Fallback Policy: {fb_policy}\n")
        prompt_sections.append("\n".join(flow_lines))

    if config.guardrails:
        guard_lines = ["### GUARDRAILS & SAFETY"]
        if config.guardrails.prohibited_topics:
            guard_lines.append(
                f"- Prohibited Topics: {', '.join(config.guardrails.prohibited_topics)}"
            )
        if config.guardrails.data_privacy_rules:
            for rule in config.guardrails.data_privacy_rules:
                guard_lines.append(f"- Data Privacy: {rule}")
        fb_msg = config.guardrails.fallback_message or (
            indian_meta["fallback"] if is_indian_lang and indian_meta else "I am unable to assist with that topic."
        )
        guard_lines.append(f"- Fallback Message: {fb_msg}\n")
        prompt_sections.append("\n".join(guard_lines))

    if config.escalation_settings and config.escalation_settings.human_handoff_enabled:
        esc_lines = ["### HUMAN ESCALATION"]
        triggers = list(config.escalation_settings.trigger_phrases or [])
        if is_indian_lang and indian_meta:
            for t in indian_meta["triggers"]:
                if t not in triggers:
                    triggers.append(t)
        esc_lines.append(f"- Trigger Phrases: {', '.join(triggers)}")

        esc_msg = config.escalation_settings.escalation_message or (
            indian_meta["escalation"] if is_indian_lang and indian_meta else "Let me connect you with a representative."
        )
        esc_lines.append(f"- Escalation Response: {esc_msg}")

        if config.escalation_settings.escalation_contact:
            esc_lines.append(f"- Contact: {config.escalation_settings.escalation_contact}")
        esc_lines.append("")
        prompt_sections.append("\n".join(esc_lines))

    if is_indian_lang and indian_meta:
        prompt_sections.append(
            f"### FINAL DIRECTIVE ({indian_meta['name']})\n"
            f"Always prioritize speaking natural, polite, and fluent {indian_meta['name']} ({indian_meta['native']}). Keep responses concise (1 to 2 spoken sentences).\n"
        )

    composite_prompt = "\n".join(prompt_sections)

    # Model selection for ElevenLabs Conversational AI
    # Eleven v4 Turbo supports all 13 Indian languages natively in ConvAI
    if config.language in {"te", "bn", "mr", "gu", "kn", "ml", "pa", "or", "ur", "as", "ne"}:
        model_id = "eleven_v4_turbo"
    elif config.language in {"hi", "ta", "hi-en"}:
        model_id = "eleven_turbo_v2_5"
    elif config.language == "en":
        model_id = "eleven_turbo_v2"
    else:
        model_id = "eleven_turbo_v2_5"

    target_voice_id = config.voice_id
    if not target_voice_id or target_voice_id == "21m00Tcm4TlvDq8ikWAM":
        target_voice_id = "hpp4J3VqNfWAUOO0d1Us"  # Bella (universal premade)

    # Ensure first_message matches the target language
    first_message = config.welcome_message
    if is_indian_lang and indian_meta and (not first_message or first_message.startswith("Hello!")):
        first_message = indian_meta["welcome"].format(name=name)
    elif config.language == "en" and not first_message:
        first_message = f"Hello! Welcome to {name}. How can I assist you today?"
    elif config.language == "es" and not first_message:
        first_message = f"¡Hola! Bienvenido a {name}. ¿En qué puedo ayudarte hoy?"

    convai_language = "hi" if config.language == "hi-en" else config.language

    # Dynamic speech read-speed calibration based on persona pace & language
    pace_str = (config.personality.pace or "normal").lower()
    if any(p in pace_str for p in ("fast", "rapid", "quick")):
        calculated_speed = 1.15 if is_indian_lang else 1.20
    elif any(p in pace_str for p in ("slow", "deliberate", "calm")):
        calculated_speed = 0.90 if is_indian_lang else 0.95
    else:
        # Optimized fluent read-speed
        calculated_speed = 1.05 if is_indian_lang else 1.10

    payload = {
        "name": name,
        "conversation_config": {
            "agent": {
                "prompt": {
                    "prompt": composite_prompt,
                    "llm": "gemini-2.0-flash",
                    "temperature": 0.1,
                },
                "first_message": first_message,
                "language": convai_language,
                "hinglish_mode": True if config.language in ("hi", "hi-en") else False,
            },
            "tts": {
                "model_id": model_id,
                "voice_id": target_voice_id,
                "stability": 0.65,
                "similarity_boost": 0.80,
                "speed": calculated_speed,
                "optimize_streaming_latency": 4,
            },
            "turn": {
                "turn_timeout": 5.0,
                "turn_eagerness": "eager",
                "speculative_turn": True,
                "spelling_patience": "auto",
            },
        },
        "platform_settings": {
            "widget": {
                "variant": "compact",
                "avatar": {
                    "type": "orb",
                    "color_1": "#10B981",
                    "color_2": "#047857",
                },
            },
            "overrides": {
                "conversation_config_override": {
                    "agent": {
                        "language": True,
                        "first_message": True,
                    },
                    "tts": {
                        "voice_id": True,
                        "model_id": True,
                        "stability": True,
                        "speed": True,
                        "similarity_boost": True,
                    },
                },
            },
            "auth": {
                "enable_auth": False,
            },
        },
    }
    return payload


class ElevenLabsClient:
    """Isolated HTTP client for ElevenLabs Conversational AI and Voice APIs."""

    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        self.api_key = api_key or settings.elevenlabs_api_key
        self.base_url = (base_url or settings.elevenlabs_base_url).rstrip("/")

    def _headers(self) -> Dict[str, str]:
        import os
        from dotenv import dotenv_values
        active_key = (
            dotenv_values(".env").get("ELEVENLABS_API_KEY")
            or os.environ.get("ELEVENLABS_API_KEY")
            or self.api_key
            or settings.elevenlabs_api_key
        )
        if not active_key:
            raise ConfigurationException(
                "ElevenLabs API key is not configured. Please set ELEVENLABS_API_KEY.",
                code="MISSING_ELEVENLABS_API_KEY",
            )
        return {
            "xi-api-key": active_key,
            "Content-Type": "application/json",
        }

    def _handle_response_errors(self, response: httpx.Response):
        status_code = response.status_code
        if status_code < 400:
            return

        try:
            err_data = response.json()
            message = (
                err_data.get("detail", {}).get("message")
                or err_data.get("message")
                or response.text
            )
        except Exception:
            message = response.text or f"HTTP {status_code}"

        logger.error("ElevenLabs API error (status=%d): %s", status_code, message)

        if status_code == 401:
            raise PermissionDeniedException(
                "ElevenLabs authentication failed. Verify your ELEVENLABS_API_KEY.",
                code="ELEVENLABS_AUTH_FAILED",
            )
        elif status_code == 403:
            raise PermissionDeniedException(
                "Forbidden: your ElevenLabs account lacks permissions for this operation or feature.",
                code="ELEVENLABS_FORBIDDEN",
            )
        elif status_code == 404:
            raise NotFoundException(
                "Requested resource was not found on ElevenLabs.",
                code="ELEVENLABS_NOT_FOUND",
            )
        elif status_code == 422:
            raise ValidationException(
                f"ElevenLabs rejected payload validation: {message}",
                code="ELEVENLABS_VALIDATION_ERROR",
            )
        elif status_code == 429:
            raise RateLimitException(
                "ElevenLabs rate limit or concurrency quota exceeded.",
                code="ELEVENLABS_RATE_LIMIT",
            )
        else:
            raise ProviderException(
                f"ElevenLabs service returned HTTP {status_code}: {message}",
                code="ELEVENLABS_PROVIDER_ERROR",
                status_code=502,
            )

    async def list_voices(self) -> List[VoiceModel]:
        """Fetch available ElevenLabs voices with fast 5-minute in-memory caching."""
        cached_voices = await default_cache.get("elevenlabs:voices:catalog")
        if cached_voices is not None:
            return cached_voices

        url = f"{self.base_url}/v1/voices"
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.get(url, headers=self._headers())
                self._handle_response_errors(res)
                data = res.json()
                raw_voices = data.get("voices", [])

                result = []
                for v in raw_voices:
                    result.append(
                        VoiceModel(
                            voice_id=v.get("voice_id", ""),
                            name=v.get("name", "Unnamed Voice"),
                            category=v.get("category"),
                            description=v.get("description"),
                            preview_url=v.get("preview_url"),
                            labels=v.get("labels", {}) or {},
                        )
                    )
                await default_cache.set("elevenlabs:voices:catalog", result, ttl_seconds=300.0)
                return result
        except (
            ConfigurationException,
            PermissionDeniedException,
            NotFoundException,
            ValidationException,
            RateLimitException,
            ProviderException,
        ):
            raise
        except Exception as exc:
            logger.exception("Failed to connect to ElevenLabs voice endpoint: %s", str(exc))
            raise ProviderException(
                "Unable to connect to ElevenLabs to retrieve voices.",
                code="ELEVENLABS_CONNECTION_ERROR",
            )

    async def create_agent(self, name: str, config: AgentConfiguration) -> str:
        """Create a conversational AI agent on ElevenLabs and return the provider agent ID."""
        url = f"{self.base_url}/v1/convai/agents/create"
        payload = map_agent_config_to_elevenlabs_payload(name, config)

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(url, json=payload, headers=self._headers())
                self._handle_response_errors(res)
                data = res.json()
                provider_agent_id = data.get("agent_id")
                if not provider_agent_id:
                    raise ProviderException(
                        "ElevenLabs response did not contain an agent_id.",
                        code="INVALID_PROVIDER_RESPONSE",
                    )
                return provider_agent_id
        except (
            ConfigurationException,
            PermissionDeniedException,
            NotFoundException,
            ValidationException,
            RateLimitException,
            ProviderException,
        ):
            raise
        except Exception as exc:
            logger.exception("Failed to create ElevenLabs conversational agent: %s", str(exc))
            raise ProviderException(
                "Network failure during ElevenLabs agent creation.",
                code="ELEVENLABS_CREATE_FAILED",
            )

    async def get_agent(self, provider_agent_id: str) -> Dict[str, Any]:
        """Retrieve remote agent configuration from ElevenLabs."""
        url = f"{self.base_url}/v1/convai/agents/{provider_agent_id}"
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.get(url, headers=self._headers())
                self._handle_response_errors(res)
                return res.json()
        except (
            ConfigurationException,
            PermissionDeniedException,
            NotFoundException,
            ValidationException,
            RateLimitException,
            ProviderException,
        ):
            raise
        except Exception as exc:
            logger.exception("Failed to retrieve ElevenLabs agent: %s", str(exc))
            raise ProviderException(
                f"Failed to retrieve ElevenLabs agent '{provider_agent_id}'.",
                code="ELEVENLABS_GET_FAILED",
            )

    async def update_agent(
        self, provider_agent_id: str, name: str, config: AgentConfiguration
    ) -> Dict[str, Any]:
        """Update an existing conversational AI agent on ElevenLabs."""
        url = f"{self.base_url}/v1/convai/agents/{provider_agent_id}"
        payload = map_agent_config_to_elevenlabs_payload(name, config)

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.patch(url, json=payload, headers=self._headers())
                self._handle_response_errors(res)
                return res.json()
        except (
            ConfigurationException,
            PermissionDeniedException,
            NotFoundException,
            ValidationException,
            RateLimitException,
            ProviderException,
        ):
            raise
        except Exception as exc:
            logger.exception("Failed to update ElevenLabs agent: %s", str(exc))
            raise ProviderException(
                f"Failed to update ElevenLabs agent '{provider_agent_id}'.",
                code="ELEVENLABS_UPDATE_FAILED",
            )

    async def delete_agent(self, provider_agent_id: str) -> bool:
        """Delete an agent from ElevenLabs."""
        url = f"{self.base_url}/v1/convai/agents/{provider_agent_id}"
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.delete(url, headers=self._headers())
                self._handle_response_errors(res)
                return True
        except NotFoundException:
            # Already deleted on remote
            return True
        except (
            ConfigurationException,
            PermissionDeniedException,
            ValidationException,
            RateLimitException,
            ProviderException,
        ):
            raise
        except Exception as exc:
            logger.exception("Failed to delete ElevenLabs agent: %s", str(exc))
            raise ProviderException(
                f"Failed to delete ElevenLabs agent '{provider_agent_id}'.",
                code="ELEVENLABS_DELETE_FAILED",
            )

    async def get_conversation_signed_url(self, provider_agent_id: str) -> str:
        """Obtain a signed conversation URL for authorized WebRTC/WebSocket browser sessions."""
        url = f"{self.base_url}/v1/convai/conversation/get-signed-url?agent_id={provider_agent_id}"
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.get(url, headers=self._headers())
                self._handle_response_errors(res)
                data = res.json()
                signed_url = data.get("signed_url")
                if not signed_url:
                    raise ProviderException(
                        "ElevenLabs response did not return a signed_url.",
                        code="INVALID_PROVIDER_RESPONSE",
                    )
                return signed_url
        except (
            ConfigurationException,
            PermissionDeniedException,
            NotFoundException,
            ValidationException,
            RateLimitException,
            ProviderException,
        ):
            raise
        except Exception as exc:
            logger.exception("Failed to get signed conversation URL: %s", str(exc))
            raise ProviderException(
                "Unable to obtain authorized conversation access URL from ElevenLabs.",
                code="ELEVENLABS_SIGNED_URL_FAILED",
            )

    async def get_conversation(self, conversation_id: str) -> Dict[str, Any]:
        """Fetch historical conversation details and transcript from ElevenLabs."""
        url = f"{self.base_url}/v1/convai/conversations/{conversation_id}"
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.get(url, headers=self._headers())
                self._handle_response_errors(res)
                return res.json()
        except (
            ConfigurationException,
            PermissionDeniedException,
            NotFoundException,
            ValidationException,
            RateLimitException,
            ProviderException,
        ):
            raise
        except Exception as exc:
            logger.exception("Failed to retrieve ElevenLabs conversation: %s", str(exc))
            raise ProviderException(
                f"Failed to retrieve conversation details for '{conversation_id}'.",
                code="ELEVENLABS_CONVERSATION_FAILED",
            )

    async def list_conversations(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Fetch list of recent conversations from ElevenLabs."""
        url = f"{self.base_url}/v1/convai/conversations"
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.get(url, headers=self._headers(), params={"page_size": limit})
                if res.status_code != 200:
                    return []
                data = res.json()
                return data.get("conversations", [])
        except Exception as exc:
            logger.warning("Failed to list ElevenLabs conversations: %s", str(exc))
            return []

    async def text_to_speech(
        self,
        text: str,
        voice_id: Optional[str] = None,
        model_id: str = "eleven_flash_v2_5",
    ) -> bytes:
        """Synthesize high-fidelity neural speech audio using ElevenLabs TTS."""
        target_voice = voice_id or "hpp4J3VqNfWAUOO0d1Us"
        # Map common legacy library voices to active premade voice for universal tier compatibility
        if target_voice in ("21m00Tcm4TlvDq8ikWAM", "Rachel"):
            target_voice = "hpp4J3VqNfWAUOO0d1Us"

        url = f"{self.base_url}/v1/text-to-speech/{target_voice}?optimize_streaming_latency=4"
        headers = self._headers()
        headers["Accept"] = "audio/mpeg"
        payload = {
            "text": text,
            "model_id": model_id,
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75,
                "speed": 1.08,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(url, json=payload, headers=headers)
                if res.status_code in (400, 402, 403):
                    # Free tier library voice fallback: retry with guaranteed premade voice
                    fallback_voice = "EXAVITQu4vr4xnSDxMaL"
                    if target_voice != fallback_voice:
                        fb_url = f"{self.base_url}/v1/text-to-speech/{fallback_voice}"
                        fb_res = await client.post(fb_url, json=payload, headers=headers)
                        if fb_res.status_code < 400:
                            return fb_res.content
                self._handle_response_errors(res)
                return res.content
        except (
            ConfigurationException,
            PermissionDeniedException,
            NotFoundException,
            ValidationException,
            RateLimitException,
            ProviderException,
        ):
            raise
        except Exception as exc:
            logger.exception("Failed to synthesize speech via ElevenLabs: %s", str(exc))
            raise ProviderException(
                "Failed to generate speech audio via ElevenLabs TTS.",
                code="ELEVENLABS_TTS_FAILED",
            )


    async def clone_voice(
        self,
        name: str,
        audio_bytes: bytes,
        filename: str = "sample.mp3",
        description: str = "",
    ) -> Dict[str, Any]:
        """Clone a voice using an audio sample via ElevenLabs Instant Voice Cloning."""
        url = f"{self.base_url}/v1/voices/add"
        headers = {
            "xi-api-key": self.api_key,
        }
        data = {
            "name": name,
            "description": description or f"Cloned custom voice {name}",
        }
        files = {
            "files": (filename, audio_bytes, "audio/mpeg"),
        }
        try:
            async with httpx.AsyncClient(timeout=45.0) as client:
                res = await client.post(url, data=data, files=files, headers=headers)
                self._handle_response_errors(res)
                return res.json()
        except (
            ConfigurationException,
            PermissionDeniedException,
            NotFoundException,
            ValidationException,
            RateLimitException,
            ProviderException,
        ):
            raise
        except Exception as exc:
            logger.exception("Failed to clone voice via ElevenLabs: %s", str(exc))
            raise ProviderException(
                "Failed to clone voice with ElevenLabs. Ensure you have voice cloning enabled.",
                code="ELEVENLABS_CLONE_FAILED",
            )

    async def list_phone_numbers(self) -> List[Dict[str, Any]]:
        """List registered phone numbers in ElevenLabs."""
        url = f"{self.base_url}/v1/convai/phone-numbers"
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(url, headers=self._headers())
                if res.status_code == 200:
                    data = res.json()
                    if isinstance(data, list):
                        return data
                    elif isinstance(data, dict):
                        return data.get("phone_numbers") or data.get("items") or []
                return []
        except Exception as exc:
            logger.warning("Could not list ElevenLabs phone numbers: %s", exc)
            return []

    async def outbound_phone_call(
        self, agent_id: str, agent_phone_number_id: str, to_number: str
    ) -> Dict[str, Any]:
        """Trigger an outbound phone call via ElevenLabs native telephony."""
        url = f"{self.base_url}/v1/convai/twilio/outbound-call"
        payload = {
            "agent_id": agent_id,
            "agent_phone_number_id": agent_phone_number_id,
            "to_number": to_number,
        }
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.post(url, json=payload, headers=self._headers())
                self._handle_response_errors(res)
                return res.json()
        except Exception as exc:
            logger.exception("Failed to dispatch outbound phone call via ElevenLabs: %s", exc)
            raise


default_elevenlabs_client = ElevenLabsClient()

