// Модуль календаря
class Calendar {
    constructor(dataService) {
        this.dataService = dataService;
        this.currentDate = new Date();
        this.selectedDate = new Date();
        
        this.init();
    }
    
    init() {
        this.render();
        this.bindEvents();
    }
    
    render() {
        this.renderMonthHeader();
        this.renderCalendarDays();
    }
    
    renderMonthHeader() {
        const month = CONFIG.MONTH_NAMES[this.currentDate.getMonth()];
        const year = this.currentDate.getFullYear();
        document.getElementById('currentMonth').textContent = `${month} ${year}`;
    }
    
    renderCalendarDays() {
        const calendarDays = document.getElementById('calendarDays');
        calendarDays.innerHTML = '';
        
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        // Первый день месяца
        const firstDay = new Date(year, month, 1);
        // Последний день месяца
        const lastDay = new Date(year, month + 1, 0);
        
        // День недели первого дня (0 = воскресенье, 1 = понедельник...)
        let firstDayIndex = firstDay.getDay();
        // Преобразуем к формату Пн=0, Вс=6
        firstDayIndex = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
        
        // Дни предыдущего месяца
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        
        // Заполняем дни предыдущего месяца
        for (let i = firstDayIndex - 1; i >= 0; i--) {
            const day = prevMonthLastDay - i;
            const date = new Date(year, month - 1, day);
            calendarDays.appendChild(this.createDayElement(date, true));
        }
        
        // Дни текущего месяца
        const today = new Date();
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const date = new Date(year, month, day);
            const isToday = date.toDateString() === today.toDateString();
            calendarDays.appendChild(this.createDayElement(date, false, isToday));
        }
        
        // Дни следующего месяца
        const totalCells = 42; // 6 строк * 7 дней
        const nextMonthDays = totalCells - (firstDayIndex + lastDay.getDate());
        
        for (let day = 1; day <= nextMonthDays; day++) {
            const date = new Date(year, month + 1, day);
            calendarDays.appendChild(this.createDayElement(date, true));
        }
    }
    
    createDayElement(date, isOtherMonth = false, isToday = false) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        
        if (isOtherMonth) {
            dayElement.classList.add('other-month');
        }
        
        if (isToday) {
            dayElement.classList.add('today');
        }
        
        const dateStr = this.dataService.formatDate(date);
        const lessons = this.dataService.getLessons(dateStr);
        
        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = date.getDate();
        
        const lessonsContainer = document.createElement('div');
        lessonsContainer.className = 'day-lessons';
        
        if (lessons.length > 0) {
            // Показываем только первые 3 урока
            lessons.slice(0, 3).forEach(lesson => {
                const lessonElement = document.createElement('div');
                lessonElement.className = 'lesson-item';
                lessonElement.innerHTML = `
                    <span class="lesson-time">${lesson.time}</span>
                    <span class="lesson-student">${lesson.student.substring(0, 6)}${lesson.student.length > 6 ? '...' : ''}</span>
                `;
                lessonElement.style.backgroundColor = CONFIG.LESSON_COLORS[lesson.type] || CONFIG.LESSON_COLORS.single;
                lessonsContainer.appendChild(lessonElement);
            });
            
            if (lessons.length > 3) {
                const moreElement = document.createElement('div');
                moreElement.className = 'lesson-item';
                moreElement.textContent = `+${lessons.length - 3} еще`;
                moreElement.style.backgroundColor = '#6c757d';
                lessonsContainer.appendChild(moreElement);
            }
        } else {
            const emptyElement = document.createElement('div');
            emptyElement.className = 'lesson-item';
            emptyElement.textContent = 'Нет уроков';
            emptyElement.style.backgroundColor = '#e9ecef';
            emptyElement.style.color = '#6c757d';
            lessonsContainer.appendChild(emptyElement);
        }
        
        dayElement.appendChild(dayNumber);
        dayElement.appendChild(lessonsContainer);
        
        // Клик по дню
        dayElement.addEventListener('click', () => {
            this.selectDate(date);
            this.showDayDetails(date, lessons);
        });
        
        return dayElement;
    }
    
    selectDate(date) {
        this.selectedDate = date;
        
        // Убираем выделение у всех дней
        document.querySelectorAll('.calendar-day').forEach(day => {
            day.classList.remove('selected');
        });
        
        // Добавляем выделение выбранному дню
        const dateStr = this.dataService.formatDate(date);
        document.querySelectorAll('.calendar-day').forEach(day => {
            if (day.querySelector('.day-number').textContent == date.getDate()) {
                // Проверяем, что это правильный месяц
                if (!day.classList.contains('other-month')) {
                    day.classList.add('selected');
                }
            }
        });
    }
    
    showDayDetails(date, lessons) {
        const dayName = CONFIG.DAY_NAMES_FULL[date.getDay()];
        const dateStr = date.toLocaleDateString('ru-RU');
        
        document.getElementById('sidebarDayTitle').textContent = `${dayName}, ${dateStr}`;
        document.getElementById('noLessonsMessage').style.display = lessons.length === 0 ? 'block' : 'none';
        
        const lessonsList = document.getElementById('lessonsList');
        lessonsList.style.display = lessons.length > 0 ? 'block' : 'none';
        lessonsList.innerHTML = '';
        
        // Сортируем уроки по времени
        lessons.sort((a, b) => {
            const timeA = this.dataService.parseTime(a.time);
            const timeB = this.dataService.parseTime(b.time);
            return timeA - timeB;
        });
        
        lessons.forEach(lesson => {
            const lessonCard = document.createElement('div');
            lessonCard.className = 'lesson-card';
            
            const endTime = this.calculateEndTime(lesson.time, lesson.duration);
            
            lessonCard.innerHTML = `
                <div class="lesson-card-header">
                    <div class="lesson-time-badge">${lesson.time} - ${endTime}</div>
                    <span class="lesson-type">${this.getLessonTypeLabel(lesson.type)}</span>
                </div>
                <div class="lesson-student">${lesson.student}</div>
                ${lesson.topic ? `<div class="lesson-topic">${lesson.topic}</div>` : ''}
                <div class="lesson-actions">
                    <button class="btn btn-sm btn-outline reschedule-lesson" data-id="${lesson.id}">
                        <i class="fas fa-exchange-alt"></i> Перенести
                    </button>
                    <button class="btn btn-sm btn-outline cancel-lesson" data-id="${lesson.id}">
                        <i class="fas fa-ban"></i> Отменить
                    </button>
                </div>
            `;
            
            lessonsList.appendChild(lessonCard);
        });
        
        // Показываем боковую панель
        document.querySelector('.sidebar').style.display = 'flex';
        
        // Привязываем события к кнопкам уроков
        this.bindLessonActions();
    }
    
    calculateEndTime(startTime, duration) {
    // Всегда используем 40 минут
    const actualDuration = CONFIG.LESSON_DURATION;
    const startMinutes = this.dataService.parseTime(startTime);
    const endMinutes = startMinutes + actualDuration;
    return this.dataService.formatTime(endMinutes);
}
    
    getLessonTypeLabel(type) {
        const labels = {
            [CONFIG.LESSON_TYPES.REGULAR]: 'Регулярный',
            [CONFIG.LESSON_TYPES.SINGLE]: 'Разовый',
            [CONFIG.LESSON_TYPES.CANCELLED]: 'Отменен',
            [CONFIG.LESSON_TYPES.RESCHEDULED]: 'Перенесен'
        };
        
        return labels[type] || 'Разовый';
    }
    
    bindLessonActions() {
        document.querySelectorAll('.reschedule-lesson').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const lessonId = e.target.closest('button').dataset.id;
                this.rescheduleLesson(lessonId);
            });
        });
        
        document.querySelectorAll('.cancel-lesson').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const lessonId = e.target.closest('button').dataset.id;
                this.cancelLesson(lessonId);
            });
        });
    }
    
    rescheduleLesson(lessonId) {
        const lesson = dataService.getLesson(lessonId);
        if (!lesson) return;
        
        // В реальном проекте здесь был бы интерфейс для выбора новой даты
        const newDate = prompt('Введите новую дату (ГГГГ-ММ-ДД):', lesson.date);
        const newTime = prompt('Введите новое время (ЧЧ:ММ):', lesson.time);
        
        if (newDate && newTime) {
            const updates = {
                date: newDate,
                time: newTime,
                type: CONFIG.LESSON_TYPES.RESCHEDULED
            };
            
            if (dataService.updateLesson(lessonId, updates)) {
                alert('Урок перенесен!');
                this.render();
                this.showDayDetails(this.selectedDate, dataService.getLessons(this.dataService.formatDate(this.selectedDate)));
            }
        }
    }
    
    cancelLesson(lessonId) {
        if (confirm('Вы уверены, что хотите отменить этот урок?')) {
            dataService.deleteLesson(lessonId);
            alert('Урок отменен!');
            this.render();
            this.showDayDetails(this.selectedDate, dataService.getLessons(this.dataService.formatDate(this.selectedDate)));
        }
    }
    
    bindEvents() {
        // Навигация по месяцам
        document.getElementById('prevMonth').addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
            this.render();
        });
        
        document.getElementById('nextMonth').addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
            this.render();
        });
        
        // Кнопки в боковой панели
        document.getElementById('addLessonBtn').addEventListener('click', () => {
            this.openAddLessonModal();
        });
        
        document.getElementById('rescheduleDayBtn').addEventListener('click', () => {
            this.rescheduleDay();
        });
        
        document.getElementById('cancelDayBtn').addEventListener('click', () => {
            this.cancelDay();
        });
        
        document.getElementById('closeSidebar').addEventListener('click', () => {
            document.querySelector('.sidebar').style.display = 'none';
        });
    }
    
    openAddLessonModal() {
        const modal = document.getElementById('lessonModal');
        const form = document.getElementById('lessonForm');
        
        // Сбрасываем форму
        form.reset();
        
        // Устанавливаем текущую дату
        const dateInput = document.createElement('input');
        dateInput.type = 'hidden';
        dateInput.id = 'lessonDate';
        dateInput.value = this.dataService.formatDate(this.selectedDate);
        
        if (!document.getElementById('lessonDate')) {
            form.appendChild(dateInput);
        } else {
            document.getElementById('lessonDate').value = this.dataService.formatDate(this.selectedDate);
        }
        
        // Показываем модальное окно
        modal.style.display = 'flex';
        
        // Закрытие модального окна
        document.getElementById('cancelLessonBtn').onclick = () => {
            modal.style.display = 'none';
        };
        
        // Обработка отправки формы
        form.onsubmit = (e) => {
            e.preventDefault();
            
            const lessonData = {
                date: document.getElementById('lessonDate').value,
                time: document.getElementById('lessonTime').value,
                duration: parseInt(document.getElementById('lessonDuration').value),
                student: document.getElementById('lessonStudent').value,
                topic: document.getElementById('lessonTopic').value
            };
            
            dataService.addLesson(lessonData);
            modal.style.display = 'none';
            
            // Обновляем интерфейс
            this.render();
            this.showDayDetails(this.selectedDate, dataService.getLessons(lessonData.date));
            
            alert('Урок добавлен!');
        };
    }
    
    rescheduleDay() {
        const lessons = dataService.getLessons(this.dataService.formatDate(this.selectedDate));
        if (lessons.length === 0) {
            alert('На этот день нет уроков для переноса');
            return;
        }
        
        const newDate = prompt('Введите новую дату для всех уроков (ГГГГ-ММ-ДД):', this.dataService.formatDate(this.selectedDate));
        if (newDate) {
            lessons.forEach(lesson => {
                dataService.updateLesson(lesson.id, {
                    date: newDate,
                    type: CONFIG.LESSON_TYPES.RESCHEDULED
                });
            });
            
            alert(`Все уроки перенесены на ${newDate}`);
            this.render();
            this.showDayDetails(this.selectedDate, []);
        }
    }
    
    cancelDay() {
        const lessons = dataService.getLessons(this.dataService.formatDate(this.selectedDate));
        if (lessons.length === 0) {
            alert('На этот день нет уроков для отмены');
            return;
        }
        
        if (confirm(`Вы уверены, что хотите отменить все уроки (${lessons.length}) на этот день?`)) {
            lessons.forEach(lesson => {
                dataService.deleteLesson(lesson.id);
            });
            
            alert('Все уроки на этот день отменены');
            this.render();
            this.showDayDetails(this.selectedDate, []);
        }
    }
}

// Инициализация календаря при загрузке страницы
let calendar;
document.addEventListener('DOMContentLoaded', () => {
    calendar = new Calendar(dataService);
});