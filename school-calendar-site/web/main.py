from fastapi import FastAPI, Request, Query, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import Optional
import sqlite3
import json

app = FastAPI(title="Школьный календарь PRO")

# Подключаем статические файлы и шаблоны
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# ============ ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ ============

def init_database():
    """Создаем все таблицы при первом запуске"""
    conn = sqlite3.connect('school.db')
    c = conn.cursor()
    
    # Учителя
    c.execute('''
        CREATE TABLE IF NOT EXISTS teachers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE,
            is_active BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Ученики  
    c.execute('''
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            parent_id INTEGER,
            email TEXT UNIQUE,
            level TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Родители
    c.execute('''
        CREATE TABLE IF NOT EXISTS parents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE,
            phone TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Занятость преподавателя
    c.execute('''
        CREATE TABLE IF NOT EXISTS teacher_availability (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            teacher_id INTEGER NOT NULL,
            day_of_week INTEGER NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            is_recurring BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (teacher_id) REFERENCES teachers (id)
        )
    ''')
    
    # Уроки
    c.execute('''
        CREATE TABLE IF NOT EXISTS lessons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            teacher_id INTEGER NOT NULL,
            student_id INTEGER NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            duration INTEGER DEFAULT 60,
            is_regular BOOLEAN DEFAULT 0,
            status TEXT DEFAULT 'scheduled',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (teacher_id) REFERENCES teachers (id),
            FOREIGN KEY (student_id) REFERENCES students (id)
        )
    ''')
    
    # Тестовые данные
    c.execute('SELECT COUNT(*) FROM teachers')
    if c.fetchone()[0] == 0:
        # Тестовые учителя
        teachers = [
            (1, 'Анна Сергеевна', 'anna@school.ru'),
            (2, 'Иван Петрович', 'ivan@school.ru'),
            (3, 'Мария Ивановна', 'maria@school.ru')
        ]
        c.executemany('INSERT INTO teachers (id, name, email) VALUES (?, ?, ?)', teachers)
        
        # Тестовый родитель и ученик
        c.execute('INSERT OR IGNORE INTO parents (id, name, email) VALUES (1, "Иван Петров", "parent@test.ru")')
        c.execute('INSERT OR IGNORE INTO students (id, name, parent_id) VALUES (1, "Алексей Иванов", 1)')
        
        # Тестовая занятость учителя
        availability = []
        for day in range(0, 5):  # Пн-Пт
            availability.append((1, day, '09:00', '18:00', 1))
        c.executemany('INSERT INTO teacher_availability (teacher_id, day_of_week, start_time, end_time, is_recurring) VALUES (?, ?, ?, ?, ?)', availability)
        
        # Тестовый урок
        c.execute('''
            INSERT OR IGNORE INTO lessons (teacher_id, student_id, start_time, end_time, is_regular)
            VALUES (1, 1, '2024-01-15T10:00:00', '2024-01-15T11:00:00', 1)
        ''')
    
    conn.commit()
    conn.close()

# Инициализируем БД при старте
init_database()

def get_db_connection():
    """Соединение с БД"""
    conn = sqlite3.connect('school.db')
    conn.row_factory = sqlite3.Row
    return conn

# ============ HTML СТРАНИЦЫ ============

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    """Главная страница"""
    return templates.TemplateResponse(
        "index.html",
        {"request": request, "title": "Школьный календарь - Главная"}
    )

@app.get("/calendar", response_class=HTMLResponse)
async def calendar_page(
    request: Request,
    role: str = Query(..., description="Роль: parent, teacher, admin"),
    user_id: Optional[int] = Query(None, description="ID пользователя (для teacher)"),
    teacher_id: Optional[int] = Query(None, description="ID преподавателя (для admin/parent)"),
    student_id: Optional[int] = Query(None, description="ID ученика (для admin/parent)"),
    view: str = Query("lessons", description="Режим: lessons или availability")
):
    """Страница календаря - доступ только по корректным параметрам"""
    
    # Валидация роли
    if role not in ['teacher', 'parent', 'admin']:
        raise HTTPException(400, detail="Некорректная роль. Допустимо: teacher, parent, admin")
    
    # Валидация режима просмотра
    if view not in ['lessons', 'availability']:
        view = 'lessons'
    
    conn = get_db_connection()
    
    try:
        if role == "teacher":
            if not user_id:
                raise HTTPException(400, detail="Для роли teacher обязателен user_id")
            
            teacher = conn.execute('SELECT name FROM teachers WHERE id = ?', (user_id,)).fetchone()
            if not teacher:
                raise HTTPException(404, detail="Преподаватель не найден")
            
            user_name = teacher["name"]
            teacher_name = user_name
            page_title = f"Календарь преподавателя {user_name}"
            is_teacher = True
            is_parent = False
            is_admin = False
            
        elif role == "parent":
            if not student_id:
                raise HTTPException(400, detail="Для роли parent обязателен student_id")
            if not teacher_id:
                raise HTTPException(400, detail="Для роли parent обязателен teacher_id (выбранный в боте)")
            
            # Проверяем ученика
            student = conn.execute('SELECT name FROM students WHERE id = ?', (student_id,)).fetchone()
            if not student:
                raise HTTPException(404, detail="Ученик не найден")
            
            # Проверяем учителя
            teacher = conn.execute('SELECT name FROM teachers WHERE id = ?', (teacher_id,)).fetchone()
            if not teacher:
                raise HTTPException(404, detail="Преподаватель не найден")
            
            user_name = student["name"]
            teacher_name = teacher["name"]
            
            if view == "availability":
                page_title = f"Расписание преподавателя {teacher_name}"
            else:
                page_title = f"Календарь ученика {user_name}"
            
            is_teacher = False
            is_parent = True
            is_admin = False
            
        elif role == "admin":
            # Админ должен указать либо teacher_id, либо student_id
            if not teacher_id and not student_id:
                raise HTTPException(400, detail="Для admin укажите teacher_id или student_id")
            
            if teacher_id:
                teacher = conn.execute('SELECT name FROM teachers WHERE id = ?', (teacher_id,)).fetchone()
                if not teacher:
                    raise HTTPException(404, detail="Преподаватель не найден")
                user_name = teacher["name"]
                teacher_name = user_name
                page_title = f"Админ: календарь преподавателя {user_name}"
                is_teacher = True
                is_parent = False
                
            elif student_id:
                student = conn.execute('SELECT name FROM students WHERE id = ?', (student_id,)).fetchone()
                if not student:
                    raise HTTPException(404, detail="Ученик не найден")
                user_name = student["name"]
                
                # Для админа показывающего ученика нужен teacher_id для schedule
                teacher_name = "Не выбран"
                page_title = f"Админ: календарь ученика {user_name}"
                is_teacher = False
                is_parent = True
            
            is_admin = True
            
    finally:
        conn.close()
    
    # Определяем какой шаблон использовать
    template_name = "calendar.html" if view == "lessons" else "schedule.html"
    
    return templates.TemplateResponse(
        template_name,
        {
            "request": request,
            "role": role,
            "user_id": user_id or teacher_id or student_id,
            "teacher_id": teacher_id,
            "student_id": student_id,
            "user_name": user_name,
            "teacher_name": teacher_name if 'teacher_name' in locals() else "",
            "view": view,
            "title": page_title,
            "is_admin": is_admin,
            "is_teacher": is_teacher,
            "is_parent": is_parent
        }
    )

# ============ API ДЛЯ КАЛЕНДАРЯ ============

@app.get("/api/calendar/lessons")
async def get_calendar_lessons(
    role: str,
    user_id: Optional[int] = None,
    teacher_id: Optional[int] = None,
    student_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Получить уроки для календаря"""
    conn = get_db_connection()
    
    query = '''
        SELECT l.*, t.name as teacher_name, s.name as student_name
        FROM lessons l
        JOIN teachers t ON l.teacher_id = t.id
        JOIN students s ON l.student_id = s.id
        WHERE l.status = 'scheduled'
    '''
    params = []
    
    # Фильтр по правам доступа
    if role == 'teacher':
        query += ' AND l.teacher_id = ?'
        params.append(user_id)
    elif role == 'parent':
        query += ' AND l.student_id = ?'
        params.append(student_id)
    elif role == 'admin' and teacher_id:
        query += ' AND l.teacher_id = ?'
        params.append(teacher_id)
    elif role == 'admin' and student_id:
        query += ' AND l.student_id = ?'
        params.append(student_id)
    else:
        conn.close()
        raise HTTPException(403, detail="Недостаточно прав")
    
    # Фильтр по дате
    if start_date and end_date:
        query += ' AND l.start_time >= ? AND l.start_time <= ?'
        params.extend([start_date, end_date])
    
    query += ' ORDER BY l.start_time'
    
    lessons = conn.execute(query, params).fetchall()
    conn.close()
    
    return {
        "lessons": [
            {
                "id": lesson["id"],
                "teacher_id": lesson["teacher_id"],
                "student_id": lesson["student_id"],
                "teacher_name": lesson["teacher_name"],
                "student_name": lesson["student_name"],
                "start": lesson["start_time"],
                "end": lesson["end_time"],
                "duration": lesson["duration"],
                "is_regular": bool(lesson["is_regular"]),
                "status": lesson["status"]
            }
            for lesson in lessons
        ]
    }

@app.get("/api/calendar/upcoming")
async def get_upcoming_lessons_api(
    role: str,
    user_id: Optional[int] = None,
    teacher_id: Optional[int] = None,
    student_id: Optional[int] = None,
    limit: int = Query(5, ge=1, le=20)
):
    """Ближайшие уроки для сайдбара"""
    conn = get_db_connection()
    
    query = '''
        SELECT l.*, t.name as teacher_name, s.name as student_name
        FROM lessons l
        JOIN teachers t ON l.teacher_id = t.id
        JOIN students s ON l.student_id = s.id
        WHERE l.start_time > datetime('now')
        AND l.status = 'scheduled'
    '''
    
    params = []
    if role == 'teacher':
        query += ' AND l.teacher_id = ?'
        params.append(user_id)
    elif role == 'parent':
        query += ' AND l.student_id = ?'
        params.append(student_id)
    elif role == 'admin' and teacher_id:
        query += ' AND l.teacher_id = ?'
        params.append(teacher_id)
    elif role == 'admin' and student_id:
        query += ' AND l.student_id = ?'
        params.append(student_id)
    
    query += ' ORDER BY l.start_time LIMIT ?'
    params.append(limit)
    
    lessons = conn.execute(query, params).fetchall()
    conn.close()
    
    return {
        "lessons": [
            {
                "id": lesson["id"],
                "teacher_name": lesson["teacher_name"],
                "student_name": lesson["student_name"],
                "start_time": lesson["start_time"],
                "end_time": lesson["end_time"],
                "is_regular": bool(lesson["is_regular"]),
                "duration": lesson["duration"]
            }
            for lesson in lessons
        ]
    }

@app.get("/api/calendar/stats")
async def get_calendar_stats(
    role: str,
    user_id: Optional[int] = None,
    teacher_id: Optional[int] = None,
    student_id: Optional[int] = None
):
    """Статистика уроков"""
    conn = get_db_connection()
    
    # Базовый запрос
    base_query = '''
        SELECT COUNT(*) as count
        FROM lessons
        WHERE status = 'scheduled'
    '''
    
    params = []
    if role == 'teacher':
        base_query += ' AND teacher_id = ?'
        params.append(user_id)
    elif role == 'parent':
        base_query += ' AND student_id = ?'
        params.append(student_id)
    elif role == 'admin' and teacher_id:
        base_query += ' AND teacher_id = ?'
        params.append(teacher_id)
    elif role == 'admin' and student_id:
        base_query += ' AND student_id = ?'
        params.append(student_id)
    
    # Уроки на этой неделе
    week_query = base_query + " AND start_time >= date('now', 'weekday 0', '-6 days') AND start_time < date('now', 'weekday 0', '+1 days')"
    week_count = conn.execute(week_query, params).fetchone()["count"]
    
    # Регулярные уроки
    regular_query = base_query + " AND is_regular = 1"
    regular_count = conn.execute(regular_query, params).fetchone()["count"]
    
    # Перенесенные уроки
    rescheduled_query = base_query + " AND updated_at != created_at"
    rescheduled_count = conn.execute(rescheduled_query, params).fetchone()["count"]
    
    conn.close()
    
    return {
        "week_lessons": week_count,
        "regular_lessons": regular_count,
        "rescheduled_lessons": rescheduled_count
    }

# ============ API ДЛЯ СЕТКИ ЗАНЯТОСТИ ============

@app.get("/api/schedule/availability")
async def get_schedule_availability(
    teacher_id: int,
    week_start: Optional[str] = None
):
    """Получить занятость преподавателя на неделю"""
    if not week_start:
        week_start = datetime.now().strftime("%Y-%m-%d")
    
    conn = get_db_connection()
    
    # 1. Получаем расписание доступности учителя
    availability = conn.execute('''
        SELECT day_of_week, start_time, end_time 
        FROM teacher_availability 
        WHERE teacher_id = ? AND is_recurring = 1
        ORDER BY day_of_week, start_time
    ''', (teacher_id,)).fetchall()
    
    # 2. Получаем уроки на неделю
    start_date = datetime.strptime(week_start, "%Y-%m-%d")
    end_date = start_date + timedelta(days=7)
    
    lessons = conn.execute('''
        SELECT l.*, s.name as student_name
        FROM lessons l
        JOIN students s ON l.student_id = s.id
        WHERE l.teacher_id = ? 
        AND l.start_time >= ? 
        AND l.start_time < ?
        AND l.status = 'scheduled'
        ORDER BY l.start_time
    ''', (teacher_id, start_date.isoformat(), end_date.isoformat())).fetchall()
    
    conn.close()
    
    return {
        "teacher_id": teacher_id,
        "week_start": week_start,
        "availability": [
            {
                "day": av["day_of_week"],
                "start": av["start_time"],
                "end": av["end_time"]
            }
            for av in availability
        ],
        "lessons": [
            {
                "id": lesson["id"],
                "student_name": lesson["student_name"],
                "start": lesson["start_time"],
                "end": lesson["end_time"],
                "is_regular": bool(lesson["is_regular"])
            }
            for lesson in lessons
        ]
    }

@app.post("/api/schedule/availability")
async def update_schedule_availability(data: dict):
    """Обновить занятость преподавателя"""
    teacher_id = data.get("teacher_id")
    availability = data.get("availability", [])
    
    conn = get_db_connection()
    
    # Удаляем старую занятость
    conn.execute('DELETE FROM teacher_availability WHERE teacher_id = ?', (teacher_id,))
    
    # Добавляем новую
    for slot in availability:
        conn.execute('''
            INSERT INTO teacher_availability (teacher_id, day_of_week, start_time, end_time)
            VALUES (?, ?, ?, ?)
        ''', (teacher_id, slot["day"], slot["start"], slot["end"]))
    
    conn.commit()
    conn.close()
    
    return {"success": True, "message": "Расписание обновлено"}

@app.post("/api/schedule/book")
async def book_time_slot(data: dict):
    """Забронировать временной слот"""
    teacher_id = data.get("teacher_id")
    student_id = data.get("student_id")
    start_time = data.get("start_time")
    duration = data.get("duration", 60)
    is_regular = data.get("is_regular", False)
    
    # Преобразуем время
    start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
    end_dt = start_dt + timedelta(minutes=duration)
    
    conn = get_db_connection()
    
    # Проверяем доступность
    # TODO: Добавить проверку конфликтов
    
    # Создаем урок
    cursor = conn.execute('''
        INSERT INTO lessons (teacher_id, student_id, start_time, end_time, duration, is_regular)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (teacher_id, student_id, start_dt.isoformat(), end_dt.isoformat(), duration, is_regular))
    
    lesson_id = cursor.lastrowid
    conn.commit()
    
    # Получаем информацию об уроке
    lesson = conn.execute('''
        SELECT l.*, t.name as teacher_name, s.name as student_name
        FROM lessons l
        JOIN teachers t ON l.teacher_id = t.id
        JOIN students s ON l.student_id = s.id
        WHERE l.id = ?
    ''', (lesson_id,)).fetchone()
    
    conn.close()
    
    return {
        "success": True,
        "lesson": dict(lesson),
        "message": "Урок успешно забронирован"
    }

# ============ API ДЛЯ ПЕРЕНОСА УРОКОВ ============

class RescheduleRequest(BaseModel):
    new_start_time: str
    transfer_type: str = "single"
    reschedule_series: bool = False

@app.post("/api/lessons/{lesson_id}/reschedule")
async def reschedule_lesson(lesson_id: int, data: RescheduleRequest):
    """Перенести урок"""
    conn = get_db_connection()
    
    # Получаем текущий урок
    lesson = conn.execute('SELECT * FROM lessons WHERE id = ?', (lesson_id,)).fetchone()
    if not lesson:
        conn.close()
        raise HTTPException(status_code=404, detail="Урок не найден")
    
    # Обновляем время урока
    new_end = datetime.fromisoformat(data.new_start_time) + timedelta(minutes=lesson["duration"])
    
    conn.execute('''
        UPDATE lessons 
        SET start_time = ?, end_time = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ''', (data.new_start_time, new_end.isoformat(), lesson_id))
    
    # Если нужно перенести всю серию регулярных уроков
    if data.reschedule_series and lesson["is_regular"]:
        # TODO: Логика переноса серии уроков
        pass
    
    conn.commit()
    
    # Возвращаем обновленный урок
    updated = conn.execute('SELECT * FROM lessons WHERE id = ?', (lesson_id,)).fetchone()
    conn.close()
    
    return {
        "success": True,
        "message": "Урок успешно перенесен",
        "lesson": dict(updated)
    }

# ============ API ДЛЯ АДМИНА ============

@app.get("/api/admin/teachers")
async def get_all_teachers():
    """Получить всех преподавателей (для админа)"""
    conn = get_db_connection()
    teachers = conn.execute('SELECT id, name, email, is_active FROM teachers').fetchall()
    conn.close()
    
    return {"teachers": [dict(t) for t in teachers]}

@app.get("/api/admin/students")
async def get_all_students():
    """Получить всех учеников (для админа)"""
    conn = get_db_connection()
    students = conn.execute('''
        SELECT s.*, p.name as parent_name 
        FROM students s
        LEFT JOIN parents p ON s.parent_id = p.id
    ''').fetchall()
    conn.close()
    
    return {"students": [dict(s) for s in students]}

# Health check
@app.get("/health")
async def health_check():
    conn = get_db_connection()
    tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    conn.close()
    
    return {
        "status": "healthy",
        "service": "school-calendar-pro",
        "tables": [t["name"] for t in tables],
        "timestamp": datetime.now().isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    print("=" * 50)
    print("     🏫 Школьный календарь PRO - Запуск")
    print("=" * 50)
    print("📍 Главная: http://localhost:8000")
    print("📍 Документация API: http://localhost:8000/docs")
    print("📍 Примеры URL:")
    print("   • Родитель: /calendar?role=parent&student_id=1&teacher_id=1")
    print("   • Учитель: /calendar?role=teacher&user_id=1")
    print("   • Админ: /calendar?role=admin&teacher_id=1")
    print("   • Сетка занятости: добавьте &view=availability")
    print("=" * 50)
    uvicorn.run(app, host="0.0.0.0", port=8000)