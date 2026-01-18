// Конфигурация приложения
const CONFIG = {
    // Время работы (для недельного расписания)
    WORK_DAY_START: 9, // 9:00
    WORK_DAY_END: 21,  // 21:00
    TIME_SLOT_DURATION: 30, // минуты
       
    // Фиксированная длительность урока
    LESSON_DURATION: 40, // минуты
    LESSON_DURATION_OPTIONS: [40], // только 40 минут
    
    // Типы занятий
    LESSON_TYPES: {
        REGULAR: 'regular',
        SINGLE: 'single',
        CANCELLED: 'cancelled',
        RESCHEDULED: 'rescheduled'
    },
    
    // Цвета для разных типов занятий
    LESSON_COLORS: {
        regular: '#ffc107',
        single: '#4a6fa5',
        cancelled: '#dc3545',
        rescheduled: '#17a2b8'
    },
    
    // Локализация
    MONTH_NAMES: [
        'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ],
    
    DAY_NAMES: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
    
    DAY_NAMES_FULL: [
        'Воскресенье', 'Понедельник', 'Вторник', 'Среда', 
        'Четверг', 'Пятница', 'Суббота'
    ]
};

// Параметры URL
const urlParams = new URLSearchParams(window.location.search);
const teacherId = urlParams.get('teacher');
const token = urlParams.get('token');

// Проверка доступа (в реальном проекте здесь была бы проверка с сервером)
/*
if (!teacherId || !token) {
    document.body.innerHTML = `
        <div class="access-denied">
            <h1><i class="fas fa-exclamation-triangle"></i> Доступ запрещен</h1>
            <p>Для доступа к календарю необходима специальная ссылка от Telegram-бота.</p>
            <p>Обратитесь к администратору для получения доступа.</p>
        </div>
    `;
    throw new Error('Доступ запрещен: отсутствуют параметры teacher или token');
}
*/
// Сохраняем ID преподавателя
window.TEACHER_ID = teacherId;