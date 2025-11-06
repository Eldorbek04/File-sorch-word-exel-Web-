// himoya-all-in-one.js
(function () {
    'use strict';
  
    // === Sozlamalar ===
    const DETECT_INTERVAL = 1200;    // DevTools aniqlash uchun interval (ms)
    const DEBUGGER_THRESHOLD = 120;  // debugger() orqali kechikish threshold (ms)
    const BLOCK_MESSAGE = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#111;color:#fff;font-family:Arial,Helvetica,sans-serif;"><div style="text-align:center;"><h1>Resurslar himoyalangan</h1><p>DevTools aniqlangan — sahifa bloklandi.</p></div></div>';
  
    // Ichki holat
    let blocked = false;
    let intervals = [];
  
    // === Yordamchi: sahifani bloklash (bir marta chaqiriladi) ===
    function showBlock() {
      if (blocked) return;
      blocked = true;
  
      // Tozalash: barcha interval va eventlarni to'xtatishga urinib ko'ramiz
      intervals.forEach(id => clearInterval(id));
      intervals = [];
  
      try {
        // Sahifani tozalash va xabar chiqarish (aggressive)
        document.documentElement.innerHTML = BLOCK_MESSAGE;
        // Agar mumkin bo'lsa headni ham tozalash
        document.head && (document.head.innerHTML = '');
      } catch (e) {
        // Agar DOM o'zgartirish imkoni bo'lmasa, fallback
        try {
          document.body && (document.body.innerHTML = BLOCK_MESSAGE);
        } catch (err) {}
      }
  
      // Console va boshqa imkoniyatlarni bekor qilamiz
      disableConsole();
    }
  
    // === 1) Kontekst menyu, tanlash va copy-ni o'chirish ===
    function blockUserActions() {
      window.addEventListener('contextmenu', function (e) {
        e.preventDefault();
      }, { capture: true });
  
      document.addEventListener('selectstart', function (e) {
        e.preventDefault();
      }, { capture: true });
  
      document.addEventListener('copy', function (e) {
        e.preventDefault();
      }, { capture: true });
  
      document.addEventListener('dragstart', function (e) {
        e.preventDefault();
      }, { capture: true });
    }
  
    // === 2) Klaviatura kombinatsiyalarini bloklash ===
    function blockKeys() {
      window.addEventListener('keydown', function (e) {
        // F12
        if (e.key === 'F12') { e.preventDefault(); e.stopPropagation(); return false; }
  
        const key = (e.key || '').toLowerCase();
  
        // Ctrl+U, Ctrl+S, Ctrl+Shift+I/J/C, Ctrl+Shift+C etc.
        if ((e.ctrlKey && key === 'u') ||
            (e.ctrlKey && key === 's') ||
            (e.ctrlKey && e.shiftKey && (key === 'i' || key === 'j' || key === 'c')) ||
            (e.metaKey && e.altKey && key === 'i') // mac: Cmd+Option+I
        ) {
          e.preventDefault(); e.stopPropagation(); return false;
        }
      }, { capture: true, passive: false });
    }
  
    // === 3) Konsol metodlarini no-op qilish ===
    function disableConsole() {
      try {
        const methods = ['log','warn','error','info','debug','table','trace'];
        methods.forEach(m => {
          try { console[m] = function () {}; } catch (e) {}
        });
        // console.clear ham no-op qilamiz
        try { console.clear = function () {}; } catch (e) {}
      } catch (e) {}
    }
  
    // === 4) Overlay (visual tampon) qo'shish ===
    function addOverlay() {
      try {
        const o = document.createElement('div');
        o.id = '__anti_inspect_overlay';
        o.style.position = 'fixed';
        o.style.top = '0';
        o.style.left = '0';
        o.style.width = '100%';
        o.style.height = '100%';
        o.style.zIndex = '2147483645';
        o.style.pointerEvents = 'none';
        // no background (faqat joy egallaydi) — agar xohlasangiz yoritish qo'shish mumkin
        document.documentElement.appendChild(o);
      } catch (e) {}
    }
  
    // === 5) DevTools aniqlash usullari ===
  
    // 5A: debugger() vaqt kechikishini tekshirish
    function detectByDebugger() {
      let last = 0;
      const id = setInterval(function () {
        const t0 = performance.now();
        // eslint-disable-next-line no-debugger
        debugger;
        const t1 = performance.now();
        if (t1 - t0 > DEBUGGER_THRESHOLD) {
          showBlock();
        }
        last = t1 - t0;
      }, DETECT_INTERVAL);
      intervals.push(id);
    }
  
    // 5B: window size / outer vs inner tekshiruvi (DevTools ochilganda o'lcham o'zgaradi)
    function detectByWindowSize() {
      let last = {w: window.innerWidth, h: window.innerHeight, ow: window.outerWidth, oh: window.outerHeight};
      const id = setInterval(function () {
        try {
          // Juda oddiy chek: outerWidth - innerWidth katta farq bo'lsa (DevTools chap/yon ochilganda)
          if (Math.abs(window.outerWidth - window.innerWidth) > 160 || Math.abs(window.outerHeight - window.innerHeight) > 160) {
            showBlock();
          } else if (Math.abs(window.innerWidth - last.w) > 300 || Math.abs(window.innerHeight - last.h) > 300) {
            // katta o'zgartirishlar
            showBlock();
          }
          last.w = window.innerWidth; last.h = window.innerHeight; last.ow = window.outerWidth; last.oh = window.outerHeight;
        } catch (e) {}
      }, Math.max(800, DETECT_INTERVAL));
      intervals.push(id);
    }
  
    // 5C: CSS getBoundingClientRect bilan oddiy detekt (ba'zi brauzerlarda ishlaydi)
    function detectByBoundingRect() {
      try {
        const el = document.createElement('div');
        el.style.position = 'fixed';
        el.style.right = '0';
        el.style.bottom = '0';
        el.style.width = '100vw';
        el.style.height = '100vh';
        el.style.visibility = 'hidden';
        document.body.appendChild(el);
        const id = setInterval(function () {
          try {
            const r = el.getBoundingClientRect();
            if (Math.abs(r.width - window.innerWidth) > 100 || Math.abs(r.height - window.innerHeight) > 100) {
              showBlock();
            }
          } catch (e) {}
        }, DETECT_INTERVAL);
        intervals.push(id);
      } catch (e) {}
    }
  
    // 5D: console api fingerprint usuli (ba'zi brauzerlarda ishlashi mumkin)
    function detectByConsoleHack() {
      // Bu usulda biz console.log ni "toString" qila oladigan maxsus obyekt bilan yozamiz
      try {
        let opened = false;
        const element = new Image();
        Object.defineProperty(element, 'id', {
          get: function () {
            opened = true;
            // agar ochilsa block
            showBlock();
          }
        });
        // Har DETECT_INTERVAL da console.log objektini chiqaramiz — agar DevTools ochilgan bo'lsa getter ishlaydi
        const id = setInterval(function () {
          opened = false;
          // console.log(element) chiqarish getterni chaqirish mumkin
          try { console.log(element); console.clear && console.clear(); } catch (e) {}
          if (opened) { showBlock(); }
        }, DETECT_INTERVAL + 300);
        intervals.push(id);
      } catch (e) {}
    }
  
    // === 6) Qo'shimcha: tarmoqdan fayl olishni qiyinlashtirish uchun header/anti-caching maslahatlari ===
    // (Bu faqat server tomonda amalga oshiriladi — bu yerda shunchaki eslatma)
  
    // === 7) Boshqaruv: barcha chora-tadbirlarni ishga tushirish ===
    function initAll() {
      // 1-2-3-4
      blockUserActions();
      blockKeys();
      disableConsole();
      addOverlay();
  
      // 5A-5D: bir nechta detekt usullarini ishga tushiramiz
      detectByDebugger();
      detectByWindowSize();
      detectByBoundingRect();
      detectByConsoleHack();
  
      // Yana bir ehtiyot chorasi: sahifa yuklanishiga ozgina "splash" timeout qo'yish
      try {
        setTimeout(function () {
          // agar kerak bo'lsa, bu yerda qo'shimcha tekshiruv yoki random chalg'itish qilinishi mumkin
        }, 600);
      } catch (e) {}
    }
  
    // Ishga tushurish
    try {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAll, { once: true });
      } else {
        initAll();
      }
    } catch (e) {
      try { initAll(); } catch (err) {}
    }
  
    // === Eslatma (konsolga qisqa xabar) ===
    try { console.info('%cHimoya scripti faollashtirildi', 'color: #2b9;'); } catch (e) {}
  
  })();
  

// TELEGRAM BRAVZURIDA HAM BLOKLASH

(function() {
    'use strict';
  
    // Telegram Web brauzer yoki in-app browser user agentini aniqlash
    const ua = navigator.userAgent || navigator.vendor || window.opera;
  
    // Telegram in-app browser uchun user agent odatda "Telegram" so'zini o'z ichiga oladi
    if (/Telegram/i.test(ua)) {
      document.documentElement.innerHTML = `
        <div style="
          display:flex;
          justify-content:center;
          align-items:center;
          height:100vh;
          background:#111;
          color:#fff;
          font-family:Arial, sans-serif;
          text-align:center;
        ">
          <div>
            <h1>Sayt Telegram brauzerida ishlamaydi</h1>
            <p>Iltimos, standart brauzer orqali kirish</p>
          </div>
        </div>
      `;
      // Konsol va boshqa ishlarni to'xtatish
      if (console) console.clear && console.clear();
    }
  })();
  