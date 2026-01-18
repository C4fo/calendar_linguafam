// Основной модуль приложения
class App {
    constructor() {
        this.init();
    }
    
    async init() {
        // Загружаем данные преподавателя
        await this.loadTeacherData();
        
        // Инициализируем интерфейс
        this.initUI();
        
        // Прячем загрузочный экран
        setTimeout(() => {
            document.getElementById('loadingScreen').style.display = 'none';
            document.querySelector('.main-interface').style.display = 'block';
        }, 1000);
    }
    
    async loadTeacherData() {
        // В реальном проекте здесь был бы запрос к API
        // Для демо используем данные из localStorage
        
        const settings = dataService.getSettings();
        document.querySelector('.teacher-name').textContent = settings.teacherName;
        document.querySelector('.teacher-id').textContent = `ID: ${TEACHER_ID}`;
    }
    
   initUI() {
    // Инициализация календаря
    calendar = new Calendar(dataService);
    
    // Инициализация недельного расписания
    weekSchedule = new WeekSchedule(dataService);
    
    // Переключение между видами
    document.getElementById('monthViewBtn').addEventListener('click', () => {
        document.getElementById('monthCalendar').style.display = 'block';
        document.getElementById('weekSchedule').style.display = 'none';
        document.getElementById('monthViewBtn').classList.add('active');
        document.getElementById('weekViewBtn').classList.remove('active');
    });
    
    document.getElementById('weekViewBtn').addEventListener('click', () => {
        document.getElementById('monthCalendar').style.display = 'none';
        document.getElementById('weekSchedule').style.display = 'block';
        document.getElementById('weekViewBtn').classList.add('active');
        document.getElementById('monthViewBtn').classList.remove('active');
    });
    
    // Закрытие модального окна при клике вне его
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('lessonModal');
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    // Добавляем кнопку для регулярных уроков (ПРОВЕРЕННЫЙ ВАРИАНТ)
    setTimeout(() => {
        const weekHeader = document.querySelector('.week-header');
        if (weekHeader && !document.getElementById('addRegularLessonBtn')) {
            const addRegularBtn = document.createElement('button');
addRegularBtn.className = 'btn btn-warning';
addRegularBtn.id = 'addRegularLessonBtn';
addRegularBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Добавить регулярный урок';
weekHeader.appendChild(addRegularBtn);
            
            // Вставляем перед кнопкой сохранения
            const saveBtn = document.getElementById('saveAvailabilityBtn');
            if (saveBtn) {
                weekHeader.insertBefore(addRegularBtn, saveBtn);
            } else {
                weekHeader.appendChild(addRegularBtn);
            }
            
           // Вешаем обработчик
addRegularBtn.addEventListener('click', () => {
    if (weekSchedule && typeof weekSchedule.addRegularLesson === 'function') {
        weekSchedule.addRegularLesson();
    } else {
        console.error('WeekSchedule не инициализирован');
        alert('Ошибка: модуль расписания не загружен');
    }
});
        }
    }, 100); // Небольшая задержка для гарантии загрузки DOM
       const regularLessonModal = document.getElementById('regularLessonModal');
    const regularLessonForm = document.getElementById('regularLessonForm');
    const cancelRegularBtn = document.getElementById('cancelRegularLessonBtn');
    
    // Закрытие модального окна
    if (cancelRegularBtn) {
        cancelRegularBtn.addEventListener('click', () => {
            regularLessonModal.style.display = 'none';
        });
    }
    
    // Закрытие при клике вне окна
    window.addEventListener('click', (e) => {
        if (e.target === regularLessonModal) {
            regularLessonModal.style.display = 'none';
        }
    });
    
    // Обработка отправки формы
    if (regularLessonForm) {
        regularLessonForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const formData = {
                day: document.getElementById('regularDay').value,
                time: document.getElementById('regularTime').value,
                duration: document.getElementById('regularDuration').value,
                title: document.getElementById('regularTitle').value
            };
            
            // Сохраняем регулярный урок
            if (weekSchedule && typeof weekSchedule.saveRegularLessonFromForm === 'function') {
                const success = weekSchedule.saveRegularLessonFromForm(formData);
                if (success) {
                    regularLessonModal.style.display = 'none';
                }
            } else {
                alert('Ошибка: модуль расписания не загружен');
            }
        });
    }
}
        
    
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});