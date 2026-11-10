document.addEventListener("DOMContentLoaded", () => {
  
  const contentArea = document.getElementById('main-content');
  const loadingBar = document.getElementById('loading-bar');
  const blocksContainer = document.getElementById('loading-blocks-container');

  // ==========================================
  // НАСТРОЙКИ
  // ==========================================
  const TOTAL_BLOCKS = 40;     
  const ANIMATION_SPEED = 10;  

  const soundClick = new Audio('sound/windows-xp-start.mp3');
  const soundLoad = new Audio('sound/loa.mp3');
  
  function playSound(audioObj) {
    audioObj.currentTime = 0; 
    audioObj.play().catch(e => console.log("Звук не найден/заблокирован:", e));
  }

  // --- 1. СОЗДАНИЕ КВАДРАТИКОВ ДЛЯ ЗАГРУЗКИ ---
  const blocks = [];
  for (let i = 0; i < TOTAL_BLOCKS; i++) {
    const block = document.createElement('div');
    block.className = 'block';
    blocksContainer.appendChild(block);
    blocks.push(block);
  }

  let currentRequestId = 0; 
  let animationInterval = null; 

  // --- 2. ЗАГРУЗКА КОНФИГА ---
  fetch('config.json')
    .then(response => {
      if(!response.ok) throw new Error('Файл config.json не найден');
      return response.json();
    })
    .then(config => {
      renderSidebar(config.sidebarLinks);
      renderTaskbar(config.taskbarLinks);
      loadPage('pages/home.html'); // Загружаем главную по умолчанию
    })
    .catch(error => {
      console.error(error);
      contentArea.innerHTML = '<p style="color:red; font-weight:bold;">Ошибка: Не удалось загрузить config.json. Убедитесь, что вы запустили сайт через Live Server.</p>';
    });

  // --- 3. ФУНКЦИЯ ЗАГРУЗКИ КОНТЕНТА (С АНИМАЦИЕЙ) ---
  function loadPage(url) {
    currentRequestId++;
    const myRequestId = currentRequestId;

    if (animationInterval) clearInterval(animationInterval);

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
        }, 150); 
      })
      .catch(() => {
        if (myRequestId !== currentRequestId) return; 
        loadingBar.style.display = 'none';
        contentArea.innerHTML = '<h2 style="color:red;">404 Страница не найдена</h2><p>Извините, этот раздел еще в разработке.</p>';
        contentArea.style.display = 'block';
      });
  }

  // --- 4. РЕКУРСИВНЫЙ РЕНДЕР БОКОВОГО МЕНЮ ---
  function renderSidebar(links) {
    const sidebar = document.querySelector('.sidebar');
    sidebar.innerHTML = '';
    
    links.forEach(link => {
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
        // Если есть подразделы — открываем/закрываем их
        const submenu = container.querySelector('.submenu');
        if (submenu) {
          submenu.classList.toggle('open');
          btn.classList.toggle('open');
        }
      } else {
        // Если это обычная страница — грузим контент
        loadPage(link.content);
      }
    });

    container.appendChild(btn);

    if (link.children) {
      const submenu = document.createElement('div');
      submenu.className = 'submenu';
      link.children.forEach(child => {
        submenu.appendChild(createMenuElement(child));
      });
      container.appendChild(submenu);
    }

    return container;
  }

  // --- 5. РЕНДЕР НИЖНЕЙ ПАНЕЛИ (С ЦВЕТАМИ ИЗ КОНФИГА) ---
  function renderTaskbar(links) {
    const taskbar = document.querySelector('.taskbar');
    const clock = document.getElementById('system-clock');
    
    links.forEach(link => {
      const a = document.createElement('a');
      a.href = link.url;
      a.target = "_blank"; 
      
      a.className = `resource-btn ${link.class || ''}`;
      a.textContent = link.title;
      
      // Применяем цвет текста
      if (link.textColor) {
        a.style.color = link.textColor;
      }
      
      // Применяем цвет фона
      if (link.bgColor) {
        a.style.backgroundColor = link.bgColor;
        a.style.setProperty('--btn-bg', link.bgColor);
        a.classList.add('custom-bg');
      }
      
      a.addEventListener('click', () => playSound(soundClick));
      taskbar.insertBefore(a, clock);
    });
  }

  // --- 6. КНОПКА "ГЛАВНАЯ" ---
  document.getElementById('home-btn').addEventListener('click', (e) => {
    e.preventDefault();
    playSound(soundClick); 
    loadPage('pages/home.html');
  });

  // --- 7. ЧАСЫ ---
  function updateClock() {
    const clockElement = document.getElementById('system-clock');
    if (!clockElement) return;
    const now = new Date();
    clockElement.textContent = `🕐 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }
  updateClock();
  setInterval(updateClock, 1000);
});