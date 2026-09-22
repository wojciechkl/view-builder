import { mount } from './lib/index.js';

const xmlOut = document.getElementById('liveXml');

const builder = mount('#builder', {
  onChange() {
    xmlOut.value = builder.getXml();
  },
});

xmlOut.value = builder.getXml();

document.getElementById('toggleHostile').addEventListener('click', () => {
  document.body.classList.toggle('hostile');
});
