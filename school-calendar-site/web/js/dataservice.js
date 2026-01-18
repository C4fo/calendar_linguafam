// Сервис для работы с данными
class DataService {
    constructor(teacherId) {
        this.teacherId = teacherId;
        this.lessonsKey = `lessons_${teacherId}`;
        this.availabilityKey = `availability_${teacherId}`;
        this.settingsKey = `settings_${teacherId}`;
        
        this.initData();
    }
    
    // Инициализация данных
    initData() {
        if (!localStorage.getItem(this.lessonsKey)) {
            localStorage.setItem(this.lessonsKey, JSON.stringify([]));
        }
        
        if (!localStorage.getItem(this.availabilityKey)) {
            localStorage.setItem(this.availabilityKey, JSON.stringify({
                regularLessons: [],
                freeSlots: {}
            }));
        }
        
        if (!localStorage.getItem(this.settingsKey)) {
            localStorage.setItem(this.settingsKey, JSON.stringify({
                teacherName: `Преподаватель ${this.teacherId}`,
                workHours: {
                    start: CONFIG.WORK_DAY_START,
                    end: CONFIG.WORK_DAY_END
                }
            }));
        }
    }
    
    // Уроки
    getLessons(date = null) {
        const lessons = JSON.parse(localStorage.getItem(this.lessonsKey));
        
        if (date) {
            const targetDate = typeof date === 'string' ? date : this.formatDate(date);
            return lessons.filter(lesson => lesson.date === targetDate);
        }
        
        return lessons;
    }
    
    getLesson(id) {
        const lessons = this.getLessons();
        return lessons.find(lesson => lesson.id === id);
    }
    
 addLesson(lesson) {
    const lessons = this.getLessons();
    const newLesson = {
        id: Date.now().toString(),
        teacherId: this.teacherId,
        date: lesson.date,
        time: lesson.time,
        duration: CONFIG.LESSON_DURATION, // Всегда 40 минут
        student: lesson.student,
        topic: lesson.topic || '',
        type: lesson.type || CONFIG.LESSON_TYPES.SINGLE,
        status: 'scheduled',
        createdAt: new Date().toISOString()
    };
    
    lessons.push(newLesson);
    localStorage.setItem(this.lessonsKey, JSON.stringify(lessons));
    
    return newLesson;
}
    
    updateLesson(id, updates) {
        const lessons = this.getLessons();
        const index = lessons.findIndex(lesson => lesson.id === id);
        
        if (index !== -1) {
            lessons[index] = { ...lessons[index], ...updates };
            localStorage.setItem(this.lessonsKey, JSON.stringify(lessons));
            return true;
        }
        
        return false;
    }
    
    deleteLesson(id) {
        const lessons = this.getLessons();
        const filteredLessons = lessons.filter(lesson => lesson.id !== id);
        localStorage.setItem(this.lessonsKey, JSON.stringify(filteredLessons));
    }
    
    // Расписание занятости
    getAvailability() {
        return JSON.parse(localStorage.getItem(this.availabilityKey));
    }
    
    saveAvailability(availability) {
        localStorage.setItem(this.availabilityKey, JSON.stringify(availability));
    }
    
    // Настройки
    getSettings() {
        return JSON.parse(localStorage.getItem(this.settingsKey));
    }
    
    updateSettings(updates) {
        const settings = this.getSettings();
        Object.assign(settings, updates);
        localStorage.setItem(this.settingsKey, JSON.stringify(settings));
    }
    
    // Вспомогательные методы
    formatDate(date) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
    }
    
    formatTime(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    }
    
    parseTime(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }
}

// Экспортируем экземпляр сервиса
const dataService = new DataService(TEACHER_ID);