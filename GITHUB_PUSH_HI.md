# GitHub Desktop पर पूरा प्रोजेक्ट एक साथ अपडेट कैसे करें

यह ZIP **repository-root ZIP** है। इसके अंदर `index.html`, `package.json`, `src/` और `.github/` सीधे root पर हैं।

1. GitHub Desktop में अपना cloned `pjmc_solar_system` repository चुनें और **Show in Explorer** खोलें।
2. इस ZIP को extract करके इसकी सभी फ़ाइलें/फ़ोल्डर उसी repository folder में कॉपी करें। Windows पूछे तो समान नाम वाली फ़ाइलों को replace करें। `.git` नाम का GitHub Desktop का hidden folder delete या replace नहीं करना है; इस ZIP में वह शामिल नहीं है।
3. GitHub Desktop पर लौटें। Changes में `src/objects/BackgroundTextRing.js`, `src/ui/i18n.js` और अन्य बदली हुई फ़ाइलें दिखनी चाहिए।
4. Summary में `Update PJMC Solar System Explorer` लिखें और **Commit to main** दबाएँ।
5. फिर **Push origin** दबाएँ।
6. GitHub repository → **Settings → Pages → Build and deployment → Source** में **GitHub Actions** चुनें।
7. **Actions** टैब में `Deploy Solar System Explorer to GitHub Pages` workflow हरा (Success) होने की प्रतीक्षा करें।
8. वेबसाइट पर `Ctrl + Shift + R` दबाकर रिफ्रेश करें।

अगर `npm ci` या `npm run build` आपके अपने कंप्यूटर पर चलाते हैं, तो Node.js 22 इस्तेमाल करें। प्रकाशित वेबसाइट `dist/` से deploy होती है—raw `src/` directory को सीधे Pages पर publish नहीं करना है।
