import { createTooth } from './toothScene.js';
import { setLang, initialLang, texts } from './i18n.js';

const { gsap, ScrollTrigger, Lenis } = window;
gsap.registerPlugin(ScrollTrigger);

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmall = window.matchMedia('(max-width: 820px)').matches;
document.documentElement.classList.toggle('is-reduced', reduced);

let lang = initialLang();
setLang(lang);
document.querySelectorAll('[data-lang]').forEach((btn) => {
  btn.addEventListener('click', () => {
    lang = btn.dataset.lang;
    setLang(lang);
    ScrollTrigger.refresh();
  });
});

const form = document.querySelector('.form');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  form.querySelector('.form__status').textContent = texts[lang]['form.sent'];
});

const compare = document.querySelector('.compare');
compare.querySelector('input').addEventListener('input', (e) => {
  compare.style.setProperty('--cut', `${e.target.value}%`);
});

let toothScene = null;
try {
  toothScene = createTooth(document.querySelector('.stage'), { isSmall });
  toothScene.setLabels([...document.querySelectorAll('.label')]);
} catch (err) {
  // Without WebGL the big word and all the text still work
  document.querySelector('.stage').remove();
  console.warn('WebGL is unavailable', err);
}
const state = toothScene ? toothScene.state : {};

const pose = isSmall
  ? {
      hero: { x: 0, y: 0.75, rotX: 0.2, rotY: -0.55, rotZ: 0.14, camZ: 13 },
      open: { x: -0.25, y: 1.85, rotX: 0.04, rotY: 0.12, rotZ: 0, camZ: 12 },
      implant: { x: 0, y: 2, rotX: 0.08, rotY: -0.5, rotZ: 0, camZ: 14 },
      done: { x: 0, y: 1.9, rotX: 0.16, rotY: 0.9, rotZ: 0.06, camZ: 12 },
    }
  : {
      hero: { x: 0, y: 0.32, rotX: 0.22, rotY: -0.55, rotZ: 0.16, camZ: 10.4 },
      open: { x: 1.25, y: 0.35, rotX: 0.05, rotY: 0.16, rotZ: 0, camZ: 8.4 },
      implant: { x: 1.3, y: 0.4, rotX: 0.08, rotY: -0.5, rotZ: 0, camZ: 11 },
      done: { x: 1.4, y: 0.2, rotX: 0.18, rotY: 0.9, rotZ: 0.06, camZ: 8.6 },
    };
// On squarer windows, bring the side-placed tooth in and step back so it clears the text
if (!isSmall) {
  const fit = Math.min(1, (window.innerWidth / window.innerHeight) / 1.5);
  for (const name of ['open', 'implant', 'done']) {
    pose[name].x *= fit;
    pose[name].camZ /= fit ** 0.5;
  }
}
Object.assign(state, pose.hero);

let pinEnd = null;
if (toothScene) {
  gsap.ticker.add((time) => {
    if (pinEnd && window.scrollY > pinEnd.end + window.innerHeight) return;
    toothScene.frame(reduced ? 0 : time);
  });
}

if (reduced) {
  state.bubbles = 0;
  state.floatAmount = 0;
} else {
  const lenis = new Lenis();
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      lenis.scrollTo(a.getAttribute('href') === '#top' ? 0 : a.getAttribute('href'));
    });
  });

  intro();
  story();
  navOnScroll();
}

function intro() {
  gsap.from('.word', { y: '+=60', duration: 1.6, ease: 'expo.out' });
  gsap.from('.intro > *', { opacity: 0, y: 16, duration: 0.9, delay: 0.5, ease: 'power2.out' });
  if (toothScene) {
    gsap.from(state, { rotY: pose.hero.rotY - 2.2, duration: 2, ease: 'expo.out' });
  }
}

function story() {
  const panels = gsap.utils.toArray('.panel');
  const tl = gsap.timeline({
    defaults: { ease: 'power2.inOut' },
    scrollTrigger: { trigger: '.scene__pin', start: 'top top', end: '+=600%', pin: true, scrub: 0.6 },
  });
  pinEnd = tl.scrollTrigger;

  const show = (el, at) => tl.fromTo(el, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.4 }, at);
  const hide = (el, at) => tl.to(el, { autoAlpha: 0, y: -20, duration: 0.4 }, at);

  tl.to('.intro', { autoAlpha: 0, duration: 0.3 }, 0);
  tl.fromTo('.word', { autoAlpha: 1 }, { autoAlpha: 0.0, duration: 0.5, immediateRender: false }, 0.1);

  // Slice the tooth open
  tl.fromTo(state, { ...pose.hero, bubbles: 1 }, { ...pose.open, bubbles: 0, duration: 1, immediateRender: false }, 0);
  tl.to(state, { section: 1, duration: 1.2 }, 0.6);
  show(panels[0], 1);
  hide(panels[0], 2.5);

  // Close it again, take the root away, lift the crown
  tl.to(state, { section: 0, duration: 0.6 }, 2.5);
  tl.fromTo(state, { ...pose.open }, { ...pose.implant, duration: 1, immediateRender: false }, 2.7);
  tl.to(state, { rootCut: 1, duration: 0.9 }, 3);
  tl.to(state, { lift: 1.1, duration: 0.6 }, 3.5);
  show(panels[1], 3.4);

  // The screw turns itself into place
  tl.to(state, { implant: 1, turn: Math.PI * 6, duration: 1.2, ease: 'power1.out' }, 3.9);
  hide(panels[1], 5.2);

  // The crown comes down onto it
  tl.to(state, { lift: 0, duration: 0.6, ease: 'power2.in' }, 5.2);
  tl.fromTo(state, { ...pose.implant }, { ...pose.done, duration: 1, immediateRender: false }, 5.4);
  show(panels[2], 5.8);
  tl.to({}, { duration: 0.8 }, 6.4);
}

function navOnScroll() {
  const nav = document.querySelector('.nav');
  ScrollTrigger.create({
    start: () => window.innerHeight,
    end: 'max',
    onUpdate: (self) => nav.classList.toggle('is-hidden', self.direction === 1),
    onLeaveBack: () => nav.classList.remove('is-hidden'),
  });
}
