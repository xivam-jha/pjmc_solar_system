import { getAuthenticatedStudent, requestStudentRecords } from './StudentAuth.js';
const STORAGE_KEY = 'pjmc_space_pilot_v1';
export const LESSONS = {
  mission_01: {
    fact: 'चाँद पृथ्वी का प्राकृतिक उपग्रह है। वह पृथ्वी की परिक्रमा करता है।',
    question: 'चाँद किसकी परिक्रमा करता है?', answers: ['पृथ्वी', 'मंगल', 'शनि'], correct: 0,
    source: 'https://science.nasa.gov/moon/facts/',
  },
  mission_02: {
    fact: 'मंगल की मिट्टी में लोहे वाले खनिजों पर जंग लगने से वह लाल दिखाई देता है।',
    question: 'मंगल के लाल रंग की वजह क्या है?', answers: ['लाल पानी', 'लोहे के खनिजों पर जंग', 'पेड़'], correct: 1,
    source: 'https://science.nasa.gov/mars/facts/',
  },
  mission_03: {
    fact: 'शनि के छल्ले मुख्यतः बर्फ के टुकड़ों, चट्टानों और धूल से बने हैं।',
    question: 'शनि के छल्लों में मुख्यतः क्या है?', answers: ['आग', 'बर्फ के टुकड़े', 'बादल'], correct: 1,
    source: 'https://science.nasa.gov/saturn/facts/',
  },
  mission_04: {
    fact: 'बृहस्पति का Great Red Spot एक विशाल तूफ़ान है।',
    question: 'Great Red Spot क्या है?', answers: ['पहाड़', 'झील', 'विशाल तूफ़ान'], correct: 2,
    source: 'https://science.nasa.gov/jupiter/facts/',
  },
};

export class StudentProgress {
  constructor() {
    this.student = getAuthenticatedStudent();
    this.storageKey = this.student ? `${STORAGE_KEY}:student:${this.student.id}` : STORAGE_KEY;
    this.data = { name: 'Pilot', badges: {}, pending: {}, photos: [], color: '#ecf2f8' };
    try {
      const saved = JSON.parse(localStorage.getItem(this.storageKey));
      if (saved && typeof saved === 'object') {
        this.data.name = typeof saved.name === 'string' ? saved.name.slice(0, 24) : 'Pilot';
        this.data.badges = Object.fromEntries(Object.keys(LESSONS).filter(id => saved.badges?.[id]).map(id => [id, true]));
        this.data.pending = Object.fromEntries(Object.keys(LESSONS).filter(id => saved.pending?.[id]).map(id => [id, true]));
        this.data.photos = Array.isArray(saved.photos) ? saved.photos.filter(p => typeof p?.image === 'string' && p.image.startsWith('data:image/jpeg;base64,') && typeof p.title === 'string').slice(-8) : [];
        if (['#ecf2f8', '#f4b942', '#ad8cff'].includes(saved.color)) this.data.color = saved.color;
      }
    } catch { /* A fresh profile also works when storage is unavailable. */ }
    if (this.student) {
      this.data.name = this.student.name;
      this.syncOnline();
    }
  }
  get stars() { return Object.keys(this.data.badges).length * 3; }
  save() {
    try { localStorage.setItem(this.storageKey, JSON.stringify(this.data)); return true; }
    catch { return false; }
  }
  award(id) {
    if (LESSONS[id]) {
      this.data.badges[id] = true;
      if (this.student) this.data.pending[id] = true;
    }
    const saved = this.save();
    if (this.student) this.syncOnline();
    return saved;
  }
  syncOnline() {
    if (!this.student) return Promise.resolve(false);
    if (this.syncing) { this.syncAgain = true; return this.syncing; }
    this.syncing = (async () => {
      let success = false;
      do {
        this.syncAgain = false;
        try {
          const result = await requestStudentRecords('load');
          for (const id of result.badges || []) if (LESSONS[id]) {
            this.data.badges[id] = true;
            delete this.data.pending[id];
          }
          for (const id of Object.keys(LESSONS)) {
            if (!this.data.pending[id]) continue;
            await requestStudentRecords('award', { mission: id, answer: LESSONS[id].correct });
            delete this.data.pending[id];
            this.save();
          }
          this.save();
          success = true;
        } catch { success = false; } // Preserve pending awards for retry/reload.
      } while (this.syncAgain);
      return success;
    })().finally(() => { this.syncing = null; });
    return this.syncing;
  }
  unlocked(index) { return index === 0 || index === 4 || Boolean(this.data.badges[`mission_0${index}`]); }
  addPhoto(image, title) {
    const previous = this.data.photos;
    this.data.photos = [...previous, { image, title, date: new Date().toISOString() }].slice(-8);
    if (this.save()) return true;
    this.data.photos = previous;
    return false;
  }
}
