// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
let calendar = null;
let selectedLessonId = null;
let selectedDate = null;
let selectedTime = null;
let currentStep = 1;
let transferType = null;

// ===== ИНИЦИАЛИЗАЦИЯ =====
document.addEventListener('DOMContentLoaded', function() {
    initCalendar();
    loadLessonsList();
    setupEventListeners();
});

// ===== КАЛЕНДАРЬ =====
function initCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;
    
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        locale: 'ru',
        slotMinTime: '08:00',
        slotMaxTime: '22:00',
        allDaySlot: false,
        nowIndicator: true,
        height: 'auto',
        
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'timeGridWeek,timeGridDay'
        },
        
        events: function(fetchInfo, successCallback, failureCallback) {
            fetch(`/api/availability/weekly?student_id=${window.studentId}`)
                .then(response => response.json())
                .then(data => {
                    const events = [];
                    
                    // Занятость учителя
                    (data.teacher_busy || []).forEach(slot => {
                        events.push({
                            title: 'Учитель занят',
                            start: slot.start,
                            end: slot.end,
                            color: '#ff6b6b',
                            display: 'background'
                        });
                    });
                    
                    // Занятость ученика
                    (data.student_busy || []).forEach(slot => {
                        events.push({
                            title: 'Ученик занят',
                            start: slot.start,
                            end: slot.end,
                            color: '#4d96ff',
                            display: 'background'
                        });
                    });
                    
                    // Уроки
                    (data.lessons || []).forEach(lesson => {
                        events.push({
                            id: `lesson-${lesson.id}`,
                            title: lesson.title || 'Урок',
                            start: lesson.start_time,
                            end: lesson.end_time,
                            color: lesson.is_regular ? '#ffd43b' : '#51cf66',
                            extendedProps: {
                                lesson_id: lesson.id,
                                teacher_name: lesson.teacher_name
                            }
                        });
                    });
                    
                    successCallback(events);
                })
                .catch(error => {
                    console.error('Ошибка загрузки календаря:', error);
                    successCallback([]); // Пустой календарь при ошибке
                });
        },
        
        eventClick: function(info) {
            const lessonId = info.event.extendedProps?.lesson_id;
            if (lessonId) {
                selectLessonForReschedule(lessonId);
            }
        }
    });
    
    calendar.render();
}

// ===== ЗАГРУЗКА СПИСКА УРОКОВ =====
function loadLessonsList() {
    const container = document.getElementById('lessons-list');
    if (!container) return;
    
    container.innerHTML = '<div class="lesson-item">Загрузка...</div>';
    
    fetch(`/api/lessons/upcoming?student_id=${window.studentId}`)
        .then(response => response.json())
        .then(data => {
            if (!data.lessons || data.lessons.length === 0) {
                container.innerHTML = '<div class="lesson-item">Нет предстоящих уроков</div>';
                return;
            }
            
            container.innerHTML = '';
            
            data.lessons.forEach(lesson => {
                const lessonEl = document.createElement('div');
                lessonEl.className = 'lesson-item';
                lessonEl.dataset.lessonId = lesson.id;
                
                const startDate = new Date(lesson.start_time);
                const endDate = new Date(lesson.end_time);
                
                lessonEl.innerHTML = `
                    <h4>${lesson.teacher_name}</h4>
                    <div class="lesson-time">
                        ${startDate.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })}<br>
                        ${startDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} - 
                        ${endDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <span class="badge ${lesson.is_regular ? 'badge-regular' : 'badge-single'}">
                        ${lesson.is_regular ? 'Регулярный' : 'Разовый'}
                    </span>
                `;
                
                lessonEl.addEventListener('click', function() {
                    selectLessonCard(lesson.id);
                });
                
                container.appendChild(lessonEl);
            });
            
            // Загружаем ближайший урок для диалога
            if (data.lessons[0]) {
                const nearestLesson = data.lessons[0];
                const nearestInfo = document.getElementById('nearest-lesson-info');
                if (nearestInfo) {
                    const startDate = new Date(nearestLesson.start_time);
                    nearestInfo.innerHTML = `
                        ${startDate.toLocaleDateString('ru-RU')}<br>
                        ${startDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    `;
                }
                window.nearestLessonId = nearestLesson.id;
            }
        })
        .catch(error => {
            container.innerHTML = '<div class="lesson-item">Ошибка загрузки</div>';
        });
}

// ===== ВЫБОР УРОКА =====
function selectLessonCard(lessonId) {
    // Снимаем выделение
    document.querySelectorAll('.lesson-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Выделяем текущий
    const selectedCard = document.querySelector(`.lesson-item[data-lesson-id="${lessonId}"]`);
    if (selectedCard) {
        selectedCard.classList.add('selected');
    }
    
    selectedLessonId = lessonId;
}

function selectLessonForReschedule(lessonId) {
    selectLessonCard(lessonId);
    showRescheduleDialog();
}

// ===== ДИАЛОГ ПЕРЕНОСА =====
function setupEventListeners() {
    const rescheduleBtn = document.getElementById('reschedule-btn');
    if (rescheduleBtn) {
        rescheduleBtn.addEventListener('click', showRescheduleDialog);
    }
    
    const overlay = document.getElementById('overlay');
    if (overlay) {
        overlay.addEventListener('click', closeDialog);
    }
}

function showRescheduleDialog() {
    if (!selectedLessonId && !window.nearestLessonId) {
        alert('Выберите урок для переноса');
        return;
    }
    
    if (!selectedLessonId && window.nearestLessonId) {
        selectedLessonId = window.nearestLessonId;
    }
    
    document.getElementById('overlay').classList.add('active');
    document.getElementById('reschedule-dialog').classList.add('active');
    currentStep = 1;
    updateDialogStep();
}

function closeDialog() {
    document.getElementById('overlay').classList.remove('active');
    document.getElementById('reschedule-dialog').classList.remove('active');
    resetDialog();
}

function selectTransferType(type) {
    transferType = type;
    
    document.querySelectorAll('.option-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    event.target.closest('.option-card').classList.add('selected');
    
    if (type === 'nearest' && window.nearestLessonId) {
        selectedLessonId = window.nearestLessonId;
    }
}

function nextStep() {
    if (currentStep === 1) {
        if (!transferType) {
            alert('Выберите тип переноса');
            return;
        }
        
        if (transferType === 'specific' && !selectedLessonId) {
            alert('Выберите урок из списка');
            return;
        }
        
        // Переходим ко второму шагу
        document.getElementById('step-1').style.display = 'none';
        document.getElementById('step-2').style.display = 'block';
        document.getElementById('next-btn').style.display = 'none';
        document.getElementById('confirm-btn').style.display = 'block';
        
        // Устанавливаем заголовок
        const titles = {
            'nearest': 'Перенос ближайшего урока',
            'regular': 'Перенос регулярного урока',
            'specific': 'Перенос выбранного урока'
        };
        document.getElementById('step-title').textContent = titles[transferType];
        
        // Загружаем доступные даты
        loadAvailableDates();
        
        currentStep = 2;
    }
}

function loadAvailableDates() {
    const container = document.getElementById('date-selector');
    if (!container) return;
    
    container.innerHTML = '<div class="date-btn">Загрузка...</div>';
    
    fetch(`/api/availability/dates?student_id=${window.studentId}&weeks_ahead=2`)
        .then(response => response.json())
        .then(data => {
            container.innerHTML = '';
            
            (data.available_dates || []).forEach(dateInfo => {
                const date = new Date(dateInfo.date + 'T12:00:00');
                const button = document.createElement('button');
                button.className = 'date-btn';
                button.dataset.date = dateInfo.date;
                
                button.innerHTML = `
                    <div class="date-btn-weekday">
                        ${date.toLocaleDateString('ru-RU', { weekday: 'short' })}
                    </div>
                    <div class="date-btn-day">${date.getDate()}</div>
                `;
                
                button.addEventListener('click', function() {
                    document.querySelectorAll('.date-btn').forEach(btn => {
                        btn.classList.remove('selected');
                    });
                    this.classList.add('selected');
                    selectedDate = this.dataset.date;
                    loadTimeSlots(selectedDate);
                });
                
                container.appendChild(button);
            });
            
            // Выбираем первую дату
            const firstBtn = container.querySelector('.date-btn');
            if (firstBtn) {
                firstBtn.click();
            }
        })
        .catch(error => {
            container.innerHTML = '<div class="date-btn">Ошибка</div>';
        });
}

function loadTimeSlots(date) {
    const container = document.getElementById('time-slots');
    if (!container) return;
    
    container.innerHTML = '<div class="time-slot">Загрузка...</div>';
    
    fetch(`/api/availability/slots?student_id=${window.studentId}&date=${date}`)
        .then(response => response.json())
        .then(data => {
            container.innerHTML = '';
            
            (data.time_slots || []).forEach(slot => {
                const slotEl = document.createElement('div');
                slotEl.className = `time-slot ${slot.is_available ? 'free' : 'busy'}`;
                slotEl.textContent = slot.time;
                slotEl.dataset.time = slot.time;
                
                if (slot.is_available) {
                    slotEl.addEventListener('click', function() {
                        document.querySelectorAll('.time-slot').forEach(s => {
                            s.classList.remove('selected');
                        });
                        this.classList.add('selected');
                        selectedTime = this.dataset.time;
                        
                        // Показываем подтверждение
                        const confirmation = document.getElementById('confirmation');
                        const selectedSlot = document.getElementById('selected-slot');
                        if (confirmation && selectedSlot) {
                            const dateObj = new Date(date + 'T' + selectedTime + ':00');
                            selectedSlot.textContent = 
                                `${dateObj.toLocaleDateString('ru-RU')} ${selectedTime}`;
                            confirmation.style.display = 'block';
                        }
                    });
                } else {
                    slotEl.style.cursor = 'not-allowed';
                }
                
                container.appendChild(slotEl);
            });
        })
        .catch(error => {
            container.innerHTML = '<div class="time-slot">Ошибка</div>';
        });
}

function confirmReschedule() {
    if (!selectedDate || !selectedTime) {
        alert('Выберите дату и время');
        return;
    }
    
    const newDateTime = `${selectedDate}T${selectedTime}:00`;
    
    fetch(`/api/lessons/${selectedLessonId}/reschedule`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            new_start_time: newDateTime,
            transfer_type: transferType,
            reschedule_series: transferType === 'regular'
        })
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message || 'Урок перенесен');
        closeDialog();
        
        // Обновляем интерфейс
        if (calendar) {
            calendar.refetchEvents();
        }
        loadLessonsList();
    })
    .catch(error => {
        alert('Ошибка при переносе урока');
    });
}

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
function resetDialog() {
    currentStep = 1;
    transferType = null;
    selectedDate = null;
    selectedTime = null;
    
    document.getElementById('step-1').style.display = 'block';
    document.getElementById('step-2').style.display = 'none';
    document.getElementById('next-btn').style.display = 'block';
    document.getElementById('confirm-btn').style.display = 'none';
    document.getElementById('confirmation').style.display = 'none';
    
    document.querySelectorAll('.option-card').forEach(card => {
        card.classList.remove('selected');
    });
}

function updateDialogStep() {
    // Можно добавить логику обновления шага
}

// ===== ЭКСПОРТ ФУНКЦИЙ ДЛЯ HTML =====
window.selectTransferType = selectTransferType;
window.nextStep = nextStep;
window.confirmReschedule = confirmReschedule;
window.showRescheduleDialog = showRescheduleDialog;
window.closeDialog = closeDialog;