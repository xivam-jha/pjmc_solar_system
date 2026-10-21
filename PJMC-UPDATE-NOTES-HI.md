# PJMC Solar System — बदलाव नोट्स (हिन्दी)

यह ZIP आपके दिए गए `solar-system-main(1).zip` को आधार बनाकर तैयार किया गया है। मौजूदा Sun, Planet, moon, ring, asteroid, starfield, texture और animation मॉड्यूल रखे गए हैं।

## शामिल बदलाव

- दुनिया के भीतर 3D `PJMC` अर्धवृत्ताकार आर्च; उसके नीचे `SOLAR SYSTEM`। यह स्क्रीन पर चिपका हुआ टेक्स्ट नहीं है। Zoom In पर इसका हिस्सा फ्रेम से बाहर जा सकता है।
- Reset View/शुरुआती कैमरा को पूरे Solar System और पूरा ब्रांड आर्च दिखाने के लिए चौड़ा किया गया है; मोबाइल की संकरी स्क्रीन के लिए क्षैतिज फिट भी गणना में शामिल है।
- ब्रांडिंग loading screen, header, footer, body information panel, browser tab title, favicon और README में जोड़ी गई है।
- English/Hindi toggle, हिन्दी body labels/facts और English/Hindi planet/moon search जोड़े गए हैं।
- simulated clock India Standard Time (IST) में दिखता है और अब `REAL TIME` से शुरू होता है। `NOW` वर्तमान समय पर वापस ले जाकर गति भी real-time करता है।
- Vite entry path relative रखा गया है और GitHub Actions build `dist/` प्रकाशित करता है।

## GitHub Desktop से लागू करना

1. इस ZIP को Extract करें।
2. Extract हुए `solar-system-main` फ़ोल्डर के अंदर की सभी फ़ाइलें अपने cloned `pjmc_solar_system` repository folder में कॉपी करें।
3. `.git` फ़ोल्डर को न हटाएँ और repository में `node_modules` कॉपी न करें।
4. GitHub Desktop में सभी changes देखकर Commit to main और Push origin करें।
5. GitHub repository → Actions में `Deploy to GitHub Pages` के Build and Deploy को हरा (success) होने दें।
6. वेबसाइट पर hard refresh (`Ctrl+Shift+R`) करें।

## जाँच की स्थिति

- सभी JavaScript files पर `node --check` सफल रहा।
- local relative import paths की जाँच सफल रही।
- सभी 20 focusable bodies के लिए हिन्दी नाम और facts मौजूद हैं।
- CSS brace-balance जाँच सफल रही।
- इस रनटाइम में npm registry से packages डाउनलोड नहीं हो सके (`EAI_AGAIN`), इसलिए यहाँ Vite production build/browser render पूरा नहीं हो पाया। Push के बाद GitHub Actions की build सफलता से इसे verify करें।

## वैज्ञानिक सटीकता

यह अभी भी शैक्षणिक/visual circular-orbit simulation है, NASA JPL जैसी precision real-time ephemeris नहीं। समय IST में प्रदर्शित होता है, मगर इससे कक्षीय गणना अपने-आप high-precision नहीं हो जाती।
