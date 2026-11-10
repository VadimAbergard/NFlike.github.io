document.addEventListener("DOMContentLoaded", () => {
  
  const contentArea = document.getElementById('main-content');
  const loadingBar = document.getElementById('loading-bar');
  const blocksContainer = document.getElementById('loading-blocks-container');
  const notifContainer = document.getElementById('notification-container');
  
  const btnSound = document.getElementById('btn-sound');
  const btnNotif = document.getElementById('btn-notif');
  const homeBtn = document.getElementById('home-btn');
  const chatBtn = document.getElementById('chat-btn');

  // ==========================================
  // НАСТРОЙКИ
  // ==========================================
  const TOTAL_BLOCKS = 40;     
  const ANIMATION_SPEED = 10;  

  let isSoundOn = true;
  let isNotifOn = false; 
  
  let notifData = null;
  let notifIndex = 0;
  let notifIntervalId = null;

  let chatIntervalId = null; 
  let chatData = null; 
  let chatHistory = []; 
  let currentVariation = null; 
  let botMessageIndex = 0; 
  let isChatInitialized = false; 
  let hasBotFinished = false;

  // Глобальная переменная для хранения конфига
  window.appConfig = null;

  const soundClick = new Audio('sound/windows-xp-start.mp3');
  const soundLoad = new Audio('sound/loa.mp3');
  
  function playSound(audioObj) {
    if (!isSoundOn) return;
    audioObj.currentTime = 0; 
    audioObj.play().catch(e => console.log("Звук не найден:", e));
  }

  // --- 1. СОЗДАНИЕ КВАДРАТИКОВ ---
  const blocks = [];
  for (let i = 0; i < TOTAL_BLOCKS; i++) {
    const block = document.createElement('div');
    block.className = 'block';
    blocksContainer.appendChild(block);
    blocks.push(block);
  }

  let currentRequestId = 0; 
  let animationInterval = null; 

  // --- 2. ЗАГРУЗКА КОНФИГОВ ---
  Promise.all([
    fetch('config.json').then(res => res.json()),
    fetch('notifications.json').then(res => res.json()).catch(() => null),
    fetch('chat.json').then(res => res.json()).catch(() => null)
  ])
  .then(async ([config, nConfig, cConfig]) => {
    window.appConfig = config; // СОХРАНЯЕМ КОНФИГ ДЛЯ БЕГУЩЕЙ СТРОКИ
    
    renderSidebar(config.sidebarLinks);
    renderTaskbar(config.taskbarLinks);
    loadPage('pages/home.html'); 

    // Загрузка уведомлений
    if (nConfig) {
      notifData = nConfig;
      for (let i = 0; i < notifData.notifications.length; i++) {
        let item = notifData.notifications[i];
        if (Array.isArray(item)) {
          for (let j = 0; j < item.length; j++) {
            if (item[j].file) {
              try { const r = await fetch(item[j].file); item[j].html = await r.text(); } catch(e){ item[j].html = "Ошибка"; }
            }
          }
        } else if (item.file) {
          try { const r = await fetch(item.file); item.html = await r.text(); } catch(e){ item.html = "Ошибка"; }
        }
      }
      if (notifData.enabled) toggleNotifications(true);
    }

    // Загрузка настроек чата и скрытие кнопки
    if (cConfig) {
      chatData = cConfig;
      if (chatData.enabled === false && chatBtn) {
        chatBtn.style.display = 'none';
      }
    }
  })
  .catch(error => {
    console.error(error);
    contentArea.innerHTML = '<p style="color:red; font-weight:bold;">Ошибка: Проверьте конфиги и запустите через Live Server.</p>';
  });

  // --- 3. ЛОГИКА УВЕДОМЛЕНИЙ ---
  function toggleNotifications(forceState) {
    if (!notifData || !notifData.notifications || notifData.notifications.length === 0) return;

    if (forceState !== undefined) isNotifOn = forceState;
    else isNotifOn = !isNotifOn;

    if (isNotifOn) {
      btnNotif.innerHTML = '🔔';
      btnNotif.classList.remove('disabled');
      showNotification({ title: "Система", html: "<b>Уведомления включены!</b>", sound: "sound/notification.wav" });

      if (notifIntervalId) clearInterval(notifIntervalId);
      
      const showNextNotification = () => {
        let item = notifData.notifications[notifIndex];
        if (Array.isArray(item)) item = item[Math.floor(Math.random() * item.length)];
        showNotification(item);
        notifIndex = (notifIndex + 1) % notifData.notifications.length;
      };
      notifIntervalId = setInterval(showNextNotification, notifData.interval || 15000);
    } else {
      btnNotif.innerHTML = '🔕';
      btnNotif.classList.add('disabled');
      if (notifIntervalId) clearInterval(notifIntervalId);
      notifContainer.innerHTML = ''; 
    }
  }

  function showNotification(notif) {
    if (notif.sound && isSoundOn) {
      const notifSound = new Audio(notif.sound);
      notifSound.play().catch(e => console.log("Звук заблокирован:", e));
    }
    const win = document.createElement('div');
    win.className = 'notif-window';
    win.innerHTML = `
      <div class="notif-title-bar">
        <span class="notif-title">${notif.title}</span>
        <button class="notif-close">✕</button>
      </div>
      <div class="notif-body">${notif.html}</div>
    `;
    notifContainer.appendChild(win);

    win.querySelector('.notif-close').addEventListener('click', () => {
      win.classList.add('hide');
      setTimeout(() => win.remove(), 300);
    });
  }

  // --- 4. ЛОГИКА ЧАТА ---
  function getUserById(id) {
    if (!currentVariation || !currentVariation.users) return { name: "Неизвестный", color: "#000" };
    const user = currentVariation.users.find(u => u.id === id);
    return user ? user : { name: "Неизвестный", color: "#000" };
  }

  function initChat() {
    if (!chatData || !chatData.variations) return;
    
    const variations = chatData.variations;
    const keys = Object.keys(variations);
    if (keys.length === 0) return;

    let totalChance = 0;
    keys.forEach(key => { totalChance += (variations[key].chance || 0); });

    if (totalChance === 0) {
      currentVariation = variations[keys[Math.floor(Math.random() * keys.length)]];
    } else {
      let randomPoint = Math.random() * totalChance;
      for (let i = 0; i < keys.length; i++) {
        let key = keys[i];
        let chance = variations[key].chance || 0;
        if (randomPoint < chance) { currentVariation = variations[key]; break; }
        randomPoint -= chance;
      }
    }

    if (!currentVariation) currentVariation = variations[keys[0]];

    chatHistory = [];
    botMessageIndex = 0; 
    isChatInitialized = true;
    hasBotFinished = false;
  }

  function addChatMessage(name, text, color = '#000', type = 'text') {
    chatHistory.push({ name, text, color, type });
    const chatWindow = document.getElementById('chat-window');
    if (chatWindow) {
      renderChatMessages(chatWindow);
    }
  }

  function renderChatMessages(chatWindow) {
    const isScrolledToBottom = chatWindow.scrollHeight - chatWindow.scrollTop <= chatWindow.clientHeight + 50;
    chatWindow.innerHTML = '';
    
    chatHistory.forEach(msg => {
      const msgDiv = document.createElement('div');
      msgDiv.style.marginBottom = '5px';
      
      let content = "";
      if (msg.type === 'image') {
        content = `<br><img src="${msg.text}" alt="Картинка" style="max-width: 100%; max-height: 150px; border: 1px solid #ccc; margin-top: 5px;">`;
      } else {
        content = ` <span>${msg.text}</span>`;
      }

      msgDiv.innerHTML = `<b style="color:${msg.color};">${msg.name}:</b>${content}`;
      chatWindow.appendChild(msgDiv);
    });

    if (isScrolledToBottom) {
      chatWindow.scrollTop = chatWindow.scrollHeight;
    }
  }

  function startChatSimulation() {
    if (chatIntervalId) clearInterval(chatIntervalId);
    
    const chatWindow = document.getElementById('chat-window');
    if (!chatWindow || !chatData) return;

    if (chatData.enabled === false) {
      chatWindow.innerHTML = '<p style="color:red; text-align:center;">Чат отключен администратором.</p>';
      return;
    }

    if (!isChatInitialized) {
      initChat();
    }
    
    renderChatMessages(chatWindow);

    const inputField = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send-btn');

    // ФУНКЦИЯ ОТПРАВКИ СООБЩЕНИЯ (БЕЗ РЕАКЦИИ БОТОВ)
    const sendUserMessage = () => {
      const text = inputField.value.trim();
      if (!text) return;

      const myName = chatData.my_name || "Гость";
      const myColor = chatData.my_color || "#008000";

      addChatMessage(myName, text, myColor, 'text');
      inputField.value = '';
      chatWindow.scrollTop = chatWindow.scrollHeight;
      playSound(soundClick);
    };

    if (sendBtn) sendBtn.onclick = sendUserMessage;
    if (inputField) {
      inputField.onkeypress = (e) => {
        if (e.key === 'Enter') sendUserMessage();
      };
    }

    // АВТОМАТИЧЕСКИЕ СООБЩЕНИЯ ОТ БОТОВ (СЦЕНАРИЙ)
    const postBotMessage = () => {
      if (!document.getElementById('chat-window')) {
        clearInterval(chatIntervalId);
        return;
      }

      if (currentVariation && currentVariation.messages) {
        if (botMessageIndex >= currentVariation.messages.length) {
          clearInterval(chatIntervalId);
          hasBotFinished = true; 
          return; 
        }

        const msgObj = currentVariation.messages[botMessageIndex];
        const userInfo = getUserById(msgObj.user_id);

        const cw = document.getElementById('chat-window');
        const isScrolledToBottom = cw.scrollHeight - cw.scrollTop <= cw.clientHeight + 50;

        addChatMessage(userInfo.name, msgObj.message, userInfo.color, msgObj.type || "text");

        if (isScrolledToBottom) {
          cw.scrollTop = cw.scrollHeight;
        }

        botMessageIndex++;
      }
    };

    chatIntervalId = setInterval(postBotMessage, chatData.interval || 3000);
  }

  // --- 5. КНОПКИ УПРАВЛЕНИЯ ---
  if (btnSound) {
    btnSound.addEventListener('click', () => {
      isSoundOn = !isSoundOn;
      btnSound.innerHTML = isSoundOn ? '🔊' : '🔇';
      btnSound.classList.toggle('disabled', !isSoundOn);
      if (isSoundOn) soundClick.play().catch(()=>{});
    });
  }

  if (btnNotif) {
    btnNotif.addEventListener('click', () => {
      if (!notifData) return;
      playSound(soundClick); 
      toggleNotifications();
    });
  }

  // --- 6. ФУНКЦИЯ ЗАГРУЗКИ КОНТЕНТА ---
  function loadPage(url) {
    currentRequestId++;
    const myRequestId = currentRequestId;

    if (animationInterval) clearInterval(animationInterval);
    if (chatIntervalId) { clearInterval(chatIntervalId); chatIntervalId = null; }

    playSound(soundLoad);
    blocks.forEach(b => b.classList.remove('active'));

    loadingBar.style.display = 'flex';
    contentArea.style.display = 'none';
    contentArea.innerHTML = ''; 

    let currentBlock = 0;
    const animatePromise = new Promise(resolve => {
      animationInterval = setInterval(() => {
        if (myRequestId !== currentRequestId) {
          clearInterval(animationInterval);
          return resolve();
        }
        if (currentBlock < TOTAL_BLOCKS) {
          blocks[currentBlock].classList.add('active');
          currentBlock++;
        } else {
          clearInterval(animationInterval);
          resolve();
        }
      }, ANIMATION_SPEED);
    });

    const fetchPromise = fetch(url).then(res => {
      if(!res.ok) throw new Error('404');
      return res.text();
    });

    Promise.all([animatePromise, fetchPromise])
      .then(([_, html]) => {
        if (myRequestId !== currentRequestId) return;
        setTimeout(() => {
          if (myRequestId !== currentRequestId) return; 
          loadingBar.style.display = 'none';
          contentArea.innerHTML = html;
          contentArea.style.display = 'block';

          // Если загружена главная, запускаем бегущую строку и новости
          if (url.includes('home.html')) {
            setupMarquee();
            loadNews();
          }
          // Если загружен чат, запускаем симуляцию
          if (url.includes('chat.html')) {
            startChatSimulation();
          }
        }, 150); 
      })
      .catch(() => {
        if (myRequestId !== currentRequestId) return; 
        loadingBar.style.display = 'none';
        contentArea.innerHTML = '<h2 style="color:red;">404 Страница не найдена</h2><p>Извините, этот раздел еще в разработке.</p>';
        contentArea.style.display = 'block';
      });
  }

  // --- 7. РЕНДЕР МЕНЮ И ТАСКБАРА ---
  function renderSidebar(links) {
    const sidebar = document.querySelector('.sidebar');
    sidebar.innerHTML = '';
    links.forEach(link => {
      if (link.isEnabled === false) return; 
      sidebar.appendChild(createMenuElement(link));
    });
  }

  function createMenuElement(link) {
    const container = document.createElement('div');
    container.className = 'menu-item';

    if (link.title === "spacer") {
      const spacer = document.createElement('div');
      spacer.className = 'sidebar-spacer';
      container.appendChild(spacer);
      return container;
    }

    const btn = document.createElement('a');
    btn.href = "#"; 
    btn.className = 'btn90';
    btn.textContent = link.title;
    
    if (link.children) btn.classList.add('has-children');

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      playSound(soundClick);
      
      if (link.children) {
        const submenu = container.querySelector('.submenu');
        if (submenu) {
          submenu.classList.toggle('open');
          btn.classList.toggle('open');
        }
      } else {
        loadPage(link.content);
      }
    });

    container.appendChild(btn);

    if (link.children) {
      const submenu = document.createElement('div');
      submenu.className = 'submenu';
      link.children.forEach(child => {
        if (child.isEnabled === false) return;
        submenu.appendChild(createMenuElement(child));
      });
      
      if (submenu.children.length > 0) {
        container.appendChild(submenu);
      } else {
        btn.classList.remove('has-children');
      }
    }
    return container;
  }

  function renderTaskbar(links) {
    const taskbar = document.querySelector('.taskbar');
    const rightBlock = document.querySelector('.taskbar-right');
    
    links.forEach(link => {
      if (link.isEnabled === false) return;

      const a = document.createElement('a');
      a.href = link.url;
      a.target = "_blank"; 
      a.className = `resource-btn ${link.class || ''}`;
      a.textContent = link.title;
      
      if (link.textColor) a.style.color = link.textColor;
      if (link.bgColor) {
        a.style.backgroundColor = link.bgColor;
        a.style.setProperty('--btn-bg', link.bgColor);
        a.classList.add('custom-bg');
      }
      
      a.addEventListener('click', () => playSound(soundClick));
      
      if (rightBlock) taskbar.insertBefore(a, rightBlock);
      else taskbar.appendChild(a);
    });
  }

  // --- 8. КНОПКИ ШАПКИ ---
  if (homeBtn) {
    homeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      playSound(soundClick); 
      loadPage('pages/home.html');
    });
  }

  if (chatBtn) {
    chatBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (chatData && chatData.enabled === false) {
        playSound(soundClick); 
        contentArea.innerHTML = '<h2 style="color:red;">Чат отключен</h2><p>Администратор временно отключил чат. Заходите позже!</p>';
        contentArea.style.display = 'block';
        return;
      }
      playSound(soundClick); 
      loadPage('pages/chat.html');
    });
  }

  // --- 9. ЧАСЫ ---
  function updateClock() {
    const clockElement = document.getElementById('system-clock');
    if (!clockElement) return;
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    clockElement.textContent = `🕐 ${h}:${m}:${s}`;
  }
  updateClock();
  setInterval(updateClock, 1000);

  // --- 10. УСТАНОВКА БЕГУЩЕЙ СТРОКИ ---
  function setupMarquee() {
    const marqueeElement = document.getElementById('main-marquee');
    if (!marqueeElement) return;

    // Если в конфиге есть массив сообщений
    if (window.appConfig && window.appConfig.marqueeMessages && window.appConfig.marqueeMessages.length > 0) {
      const messages = window.appConfig.marqueeMessages;
      // Выбираем случайное
      const randomMsg = messages[Math.floor(Math.random() * messages.length)];
      marqueeElement.textContent = randomMsg;
    } else {
      // Если конфига нет, ставим стандартный текст
      marqueeElement.textContent = ">>> Привет! Ты — наш тысячный посетитель! <<<";
    }
  }

  // --- 11. ЗАГРУЗКА НОВОСТЕЙ ---
  function loadNews() {
    const container = document.getElementById('news-container');
    if (!container) return;

    fetch('news.json')
      .then(res => res.json())
      .then(data => {
        if (!data.news || data.news.length === 0) {
          container.innerHTML = '<p>Пока новостей нет.</p>';
          return;
        }

        container.innerHTML = '<div class="news-grid"></div>';
        const grid = container.querySelector('.news-grid');

        data.news.forEach(item => {
          const card = document.createElement('a');
          card.className = 'news-card';
          card.href = '#'; 
          
          if (item.link) {
            card.addEventListener('click', (e) => {
              e.preventDefault();
              playSound(soundClick);
              loadPage(item.link);
            });
          }

          // Генерируем теги
          let tagsHtml = '';
          if (item.tags && item.tags.length > 0) {
            tagsHtml = `<div class="news-tags">
              ${item.tags.map(tag => `<span class="news-tag">${tag}</span>`).join('')}
            </div>`;
          }

          // Картинка
          const imgHtml = item.image 
            ? `<div class="news-img-wrapper"><img src="${item.image}" class="news-img" alt="${item.title}"></div>`
            : `<div class="news-img-wrapper" style="background:#ccc;"></div>`;
          
          card.innerHTML = `
            ${imgHtml}
            <div class="news-info">
              ${tagsHtml}
              <h3 class="news-title">${item.title}</h3>
              <p class="news-desc">${item.description}</p>
              <div class="news-date">${item.date}</div>
            </div>
          `;

          grid.appendChild(card);
        });
      })
      .catch(err => {
        console.error('Ошибка загрузки новостей:', err);
        container.innerHTML = '<p style="color:red;">Не удалось загрузить новости.</p>';
      });
  }

});