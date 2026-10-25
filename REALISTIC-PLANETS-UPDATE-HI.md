# PJMC Solar System — Planet Texture Update

## क्या बदला

1. Texture loading अब Solar System Scope के आधिकारिक texture page से लिंक हुए `play.solarsystemscope.com` endpoint को पहले आज़माता है। यही मुख्य सुधार है जिससे पहले दिख रहे procedural planets के बजाय image-based planetary maps लोड हो सकेंगे।
2. आठों प्रमुख ग्रह और Earth का Moon image maps लोड करते हैं; बाकी छोटे चंद्रमा पुराने generated fallback पर बने रहते हैं।
3. पृथ्वी पर day map, night-city-lights map और अलग grayscale cloud opacity map है।
4. धीमे इंटरनेट पर app 12 सेकंड बाद fallback के साथ शुरू हो सकती है; texture बाद में सफलतापूर्वक आए तो पहले से बने ग्रहों पर भी लागू होती है।
5. Close-up में गोलाई बेहतर रखने के लिए planet geometry में segments बढ़ाए गए हैं। मूल orbital, camera, labels, spacecraft और UI architecture सुरक्षित रखा गया है।

## चलाने का तरीका

- ZIP extract करें।
- Node.js 20.19+ या 22.12+ की अनुशंसित supported release रखें (Vite 8 के अनुसार)।
- Project folder में `npm install` चलाएँ।
- `npm run dev` से development server शुरू करें, या `npm run build` से production build बनाएँ।
- Production deploy में पूरी build output को अपनी hosting पर upload करें।

## ध्यान दें

Planet maps एक precomputed visualization हैं, live NASA satellite feed नहीं। External texture host blocked/offline हो तो generated fallback दिखेगा। Texture attribution/CC BY 4.0 credit `PLANET_TEXTURE_ATTRIBUTION.md` में दिया है।
