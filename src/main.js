import { mount, addLanguage } from './lib/index.js';
import pl from './lib/lang/pl.js';

addLanguage('pl', pl);

const xmlOut = document.getElementById('liveXml');

const builder = mount('#builder', {
  language: 'en',
  onChange() {
    xmlOut.value = builder.getXml();
  },
});

xmlOut.value = builder.getXml();

document.getElementById('toggleHostile').addEventListener('click', () => {
  document.body.classList.toggle('hostile');
});

document.getElementById('language').addEventListener('change', (event) => {
  builder.setLanguage(event.target.value);
});
