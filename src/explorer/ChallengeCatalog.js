// Short, independent single-player challenges. Flight controls are shared.
export const CHALLENGES = [
  {
    id: 'challenge_01', num: 'C1', kind: 'rescue', title: 'SOS Rescue', titleHi: 'बचाव अभियान',
    target: 'earth', difficulty: 'EASY', reward: 'Rescue Captain', duration: '3 min limit',
    summary: '3 capsules · safe return',
    descHi: '3 capsules के पास BRAKE लगाकर रुकें, फिर rescue station पहुँचें। मलबे से बचें; समय 3 मिनट।',
  },
  {
    id: 'challenge_02', num: 'C2', kind: 'repair', title: 'Satellite Repair', titleHi: 'सैटेलाइट सुधारें',
    target: 'earth', difficulty: 'MEDIUM', reward: 'Space Engineer', duration: 'No time limit',
    summary: '3 parts · steady repair',
    descHi: '3 spare parts जुटाएँ। Satellite के पास धीमे और स्थिर रहें—6 सेकंड में auto repair होगा।',
  },
  {
    id: 'challenge_03', num: 'C3', kind: 'cargo', title: 'Fragile Cargo', titleHi: 'नाज़ुक सामान',
    target: 'moon', difficulty: 'MEDIUM', reward: 'Careful Courier', duration: 'No time limit',
    summary: 'Deliver with care',
    descHi: '2 route beacons पार करके Lunar Transfer Station पर science cargo पहुँचाएँ। तेज़ मोड़ और टक्कर से सामान टूटता है।',
  },
  {
    id: 'challenge_04', num: 'C4', kind: 'signal', title: 'Lost Signal', titleHi: 'खोया संकेत',
    target: 'mars', difficulty: 'EASY', reward: 'Signal Seeker', duration: 'No time limit',
    summary: 'Follow the signal',
    descHi: 'Signal % बढ़ने वाली दिशा में उड़ें। Probe के पास रुककर data लें। जरूरत पर 8 सेकंड का direction hint लें।',
  },
  {
    id: 'challenge_05', num: 'C5', kind: 'sample', title: 'Asteroid Samples', titleHi: 'चट्टानों के नमूने',
    target: 'jupiter', difficulty: 'HARD', reward: 'Rock Detective', duration: 'No time limit',
    summary: 'Scan 3 marked rocks',
    descHi: 'C, S और M label वाली 3 चट्टानों के पास रुककर sample scan करें। आसपास घूमते मलबे से hull बचाएँ।',
  },
  {
    id: 'challenge_06', num: 'C6', kind: 'relay', title: 'Laser Link', titleHi: 'सिग्नल जोड़ें',
    target: 'earth', difficulty: 'PUZZLE', reward: 'Relay Architect', duration: 'No time limit',
    summary: 'Align 3 relay dishes',
    descHi: 'हर relay के पास रुकें। Dial की दिशा gold target से मिलाकर Link दबाएँ; तीनों relays से Earth तक signal जोड़ें।',
  },
].map(m => ({ ...m, category: 'challenges', waypoints: [], desc: m.summary }));

export const CHALLENGE_LESSONS = {
  challenge_01: {
    fact: 'Spacesuit का life-support system astronaut को साँस लेने के लिए oxygen देता है।',
    question: 'Spacesuit में साँस लेने के लिए क्या मिलता है?', answers: ['Oxygen', 'धुआँ', 'मिट्टी'], correct: 0,
    source: 'https://www.nasa.gov/learning-resources/for-kids-and-students/what-is-a-spacesuit-grades-5-8/',
  },
  challenge_02: {
    fact: 'Satellite के solar panels सूर्य की ऊर्जा को बिजली में बदलते हैं।',
    question: 'Solar panels किससे बिजली बनाते हैं?', answers: ['ध्वनि', 'सूर्य की ऊर्जा', 'हवा का दबाव'], correct: 1,
    source: 'https://spaceplace.nasa.gov/what-powers-a-spacecraft/en/',
  },
  challenge_03: {
    fact: 'चाँद की सतह पर गुरुत्वाकर्षण पृथ्वी की सतह के लगभग छठे हिस्से जितना है।',
    question: 'चाँद की सतह पर गुरुत्वाकर्षण पृथ्वी से कैसा है?', answers: ['छह गुना', 'बराबर', 'लगभग छठा हिस्सा'], correct: 2,
    source: 'https://science.nasa.gov/moon/facts/',
  },
  challenge_04: {
    fact: 'अंतरिक्ष यान radio waves से data भेज सकते हैं। ये विद्युतचुंबकीय तरंगें हैं।',
    question: 'Radio waves किस तरह की तरंगें हैं?', answers: ['विद्युतचुंबकीय', 'पानी की लहरें', 'ध्वनि'], correct: 0,
    source: 'https://www.nasa.gov/goddard/esc/about/',
  },
  challenge_05: {
    fact: 'बहुत से asteroids मंगल और बृहस्पति के बीच main asteroid belt में सूर्य की परिक्रमा करते हैं।',
    question: 'Main asteroid belt किन ग्रहों के बीच है?', answers: ['पृथ्वी और शुक्र', 'मंगल और बृहस्पति', 'शनि और अरुण'], correct: 1,
    source: 'https://science.nasa.gov/solar-system/asteroids/facts/',
  },
  challenge_06: {
    fact: 'Optical communication में laser light के जरिए data भेजा जाता है। Beam की सही दिशा जरूरी है।',
    question: 'Laser communication में data किससे भेजते हैं?', answers: ['ध्वनि', 'हवा', 'प्रकाश'], correct: 2,
    source: 'https://www.nasa.gov/technology/space-comms/optical-communications-overview/',
  },
};
