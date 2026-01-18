// Модуль недельного расписания - ВОЗВРАЩАЕМ СТАРУЮ СТРУКТУРУ
class WeekSchedule {
    constructor(dataService) {
        this.dataService = dataService;
        this.currentWeekStart = this.getMonday(new Date());
        
        this.init();
    }
    
    init() {
        this.loadAvailability();
        this.render();
        this.bindEvents();
    }
    
    getMonday(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    }
    
    loadAvailability() {
        const availability = this.dataService.getAvailability();
        this.regularLessons = availability.regularLessons || [];
        this.freeSlots = availability.freeSlots || {};
    }
    
    saveAvailability() {
        const availability = {
            regularLessons: this.regularLessons,
            freeSlots: this.freeSlots
        };
        
        this.dataService.saveAvailability(availability);
        alert('Расписание сохранено!');
    }
    
    render() {
        this.renderWeekHeader();
        this.renderWeekGrid();
    }
    
    renderWeekHeader() {
        const weekEnd = new Date(this.currentWeekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        const startStr = this.currentWeekStart.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        const endStr = weekEnd.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        
        document.getElementById('currentWeek').textContent = `${startStr} - ${endStr}`;
    }
    
    renderWeekGrid() {
        const weekGrid = document.getElementById('weekGrid');
        weekGrid.innerHTML = '';
        
        // Создаем контейнер для сетки
        const gridContainer = document.createElement('div');
        gridContainer.className = 'week-grid-container';
        
        // Временная колонка слева
        const timeColumn = document.createElement('div');
        timeColumn.className = 'time-column';
        
        // Пустой уголок
        const cornerCell = document.createElement('div');
        cornerCell.className = 'corner-cell';
        timeColumn.appendChild(cornerCell);
        
        // Заполняем временные слоты (каждые 30 минут)
        for (let hour = CONFIG.WORK_DAY_START; hour < CONFIG.WORK_DAY_END; hour++) {
            for (let minute = 0; minute < 60; minute += CONFIG.TIME_SLOT_DURATION) {
                const timeSlot = document.createElement('div');
                timeSlot.className = 'time-slot';
                timeSlot.textContent = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                timeColumn.appendChild(timeSlot);
            }
        }
        
        gridContainer.appendChild(timeColumn);
        
        // Дни недели
        const dayNames = ['ПН', 'ВТ', 'СР', 'Чт', 'ПТ', 'СБ', 'ВС'];
        
        for (let day = 0; day < 7; day++) {
            const dayColumn = document.createElement('div');
            dayColumn.className = 'day-column';
            
            // Заголовок дня
            const date = new Date(this.currentWeekStart);
            date.setDate(date.getDate() + day);
            const dateStr = this.dataService.formatDate(date);
            
            const dayHeader = document.createElement('div');
            dayHeader.className = 'day-header-week';
            dayHeader.innerHTML = `
                <div class="day-abbr">${dayNames[day]}</div>
                <div class="day-number">${date.getDate()}</div>
            `;
            
            // Подсветка сегодняшнего дня
            const today = new Date();
            if (date.toDateString() === today.toDateString()) {
                dayHeader.classList.add('today');
            }
            
            dayColumn.appendChild(dayHeader);
            
            // Получасовые ячейки для этого дня
            for (let hour = CONFIG.WORK_DAY_START; hour < CONFIG.WORK_DAY_END; hour++) {
                for (let minute = 0; minute < 60; minute += CONFIG.TIME_SLOT_DURATION) {
                    const timeCell = document.createElement('div');
                    timeCell.className = 'time-cell';
                    timeCell.dataset.date = dateStr;
                    timeCell.dataset.time = `${hour}:${String(minute).padStart(2, '0')}`;
                    timeCell.dataset.minutes = hour * 60 + minute;
                    
                    // Проверяем статус ячейки
                    const status = this.getCellStatus(date, hour, minute);
                    timeCell.classList.add(status.type);
                    timeCell.title = this.getCellTitle(status, hour, minute);
                    
                    // Если ячейка занята регулярным уроком - недоступна для изменения
                    if (status.type === 'regular-busy') {
                        timeCell.style.cursor = 'not-allowed';
                    } else {
                        timeCell.addEventListener('click', () => this.toggleTimeSlot(timeCell, date, hour, minute));
                    }
                    
                    // Индикатор
                    const indicator = document.createElement('div');
                    indicator.className = 'time-indicator';
                    timeCell.appendChild(indicator);
                    
                    dayColumn.appendChild(timeCell);
                }
            }
            
            gridContainer.appendChild(dayColumn);
        }
        
        weekGrid.appendChild(gridContainer);
    }
    
    getCellStatus(date, hour, minute) {
        const dateStr = this.dataService.formatDate(date);
        const cellTime = hour * 60 + minute;
        const dayOfWeek = date.getDay();
        
        // 1. Проверяем регулярные уроки преподавателя (занято своими делами)
        const hasRegularLesson = this.regularLessons.some(lesson => {
            const lessonTime = this.dataService.parseTime(lesson.time);
            const lessonEnd = lessonTime + lesson.duration;
            return lesson.dayOfWeek === dayOfWeek && 
                   cellTime >= lessonTime && 
                   cellTime < lessonEnd;
        });
        
       // 2. Проверяем запланированные уроки с учениками
const lessons = this.dataService.getLessons(dateStr);
const hasScheduledLesson = lessons.some(lesson => {
    const lessonTime = this.dataService.parseTime(lesson.time);
    const lessonEnd = lessonTime + CONFIG.LESSON_DURATION; // Всегда 40 минут
    return cellTime >= lessonTime && cellTime < lessonEnd;
});
        
        // 3. Проверяем свободные слоты (помеченные зеленым)
        const slotKey = `${dateStr}_${hour}:${String(minute).padStart(2, '0')}`;
        const isFreeSlot = this.freeSlots[slotKey] === true;
        
        // Определяем тип ячейки
        if (hasScheduledLesson) {
            return { type: 'lesson-busy', message: 'Занято уроком' };
        } else if (hasRegularLesson) {
            return { type: 'regular-busy', message: 'Занято регулярным уроком' };
        } else if (isFreeSlot) {
            return { type: 'free', message: 'Свободное окно' };
        } else {
            return { type: 'available', message: 'Доступно' };
        }
    }
    
    getCellTitle(status, hour, minute) {
        const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        return `${timeStr} - ${status.message}`;
    }
    
    toggleTimeSlot(cell, date, hour, minute) {
        // Можно изменять только доступные ячейки
        if (cell.classList.contains('regular-busy') || cell.classList.contains('lesson-busy')) {
            return;
        }
        
        const dateStr = this.dataService.formatDate(date);
        const slotKey = `${dateStr}_${hour}:${String(minute).padStart(2, '0')}`;
        
        if (cell.classList.contains('free')) {
            // Убираем свободный слот
            cell.classList.remove('free');
            cell.classList.add('available');
            cell.title = cell.title.replace('Свободное окно', 'Доступно');
            delete this.freeSlots[slotKey];
        } else {
            // Добавляем свободный слот
            cell.classList.remove('available');
            cell.classList.add('free');
            cell.title = cell.title.replace('Доступно', 'Свободное окно');
            this.freeSlots[slotKey] = true;
        }
    }
    
    addRegularLesson() {
    // Показываем модальное окно
    const modal = document.getElementById('regularLessonModal');
    const form = document.getElementById('regularLessonForm');
    
    // Сбрасываем форму
    form.reset();
    
    // Показываем модальное окно
    modal.style.display = 'flex';
    
    // Флаг для отслеживания открытого модального окна
    this.regularLessonModalOpen = true;
}

// Добавим новый метод для обработки сохранения
saveRegularLessonFromForm(formData) {
    const dayOfWeek = parseInt(formData.day);
    const time = formData.time;
    const duration = parseInt(formData.duration);
    const title = formData.title || '';
    
    if (isNaN(dayOfWeek) || !time || isNaN(duration)) {
        alert('Заполните все обязательные поля');
        return false;
    }
    
    // Проверяем валидность времени
    const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timeRegex.test(time)) {
        alert('Некорректное время');
        return false;
    }
    
    // Проверяем, что урок кратен 30 минутам
    const lessonTime = this.dataService.parseTime(time);
    if (lessonTime % 30 !== 0) {
        alert('Время урока должно быть кратно 30 минутам (например, 9:00, 9:30, 10:00)');
        return false;
    }
    
    if (duration % 30 !== 0) {
        alert('Продолжительность урока должна быть кратной 30 минутам');
        return false;
    }
    
    // Добавляем урок
    this.regularLessons.push({
        dayOfWeek: dayOfWeek,
        time: time,
        duration: duration,
        title: title,
        addedAt: new Date().toISOString()
    });
    
    // Обновляем интерфейс
    this.render();
    
    // Показываем сообщение
    const dayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    alert(`Регулярный урок добавлен: ${dayNames[dayOfWeek]} в ${time}`);
    
    return true;
}
    bindEvents() {
        document.getElementById('prevWeek').addEventListener('click', () => {
            this.currentWeekStart.setDate(this.currentWeekStart.getDate() - 7);
            this.render();
        });
        
        document.getElementById('nextWeek').addEventListener('click', () => {
            this.currentWeekStart.setDate(this.currentWeekStart.getDate() + 7);
            this.render();
        });
        
        document.getElementById('saveAvailabilityBtn').addEventListener('click', () => {
            this.saveAvailability();
        });
    }
}

// Инициализация недельного расписания
let weekSchedule;