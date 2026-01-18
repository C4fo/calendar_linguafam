// constants.js
const CONSTANTS = {
    // Время работы
    WORK_DAY_START: 9, // 9:00
    WORK_DAY_END: 21,  // 21:00
    TIME_SLOT_DURATION: 30, // минуты
    
    // Длительность урока
    LESSON_DURATION: 40, // минуты
    
    // Типы занятий
    LESSON_TYPES: {
        REGULAR: 'regular',
        SINGLE: 'single',
        CANCELLED: 'cancelled',
        RESCHEDULED: 'rescheduled'
    },
    
    // Цвета
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

// Экспортируем
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONSTANTS;
} else {
    window.CONSTANTS = CONSTANTS;
    window.CONFIG = CONSTANTS; // для обратной совместимости
}