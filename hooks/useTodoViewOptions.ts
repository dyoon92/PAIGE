import { useState, useEffect, useMemo, useCallback } from 'react';
import Fuse from 'fuse.js';
import type { TodoItem } from '@/types/todo';

// Helper to get the group for a given deadline
function getTaskGroup(deadline?: Date | null): string {
  if (!deadline || !(deadline instanceof Date) || isNaN(deadline.getTime())) {
    return 'No date yet';
  }
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
  const diffDays = Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'Overdue';
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays <= 7) return 'This Week';
  if (diffDays <= 14) return 'Next Week';
  if (diffDays <= 30) return 'This Month';
  if (diffDays <= 60) return 'Next Month';
  return 'Later';
}

export function useTodoViewOptions(todoItems: TodoItem[]) {
  // Search state
  const [todoSearchQuery, setTodoSearchQuery] = useState("");

  // View mode state
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [calendarViewMode, setCalendarViewMode] = useState<'month' | 'week' | 'day' | 'year'>('month');
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());

  // Filter state
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);
  const [showCompletedItems, setShowCompletedItems] = useState(false);

  // Sort state
  const [sortBy, setSortBy] = useState<'name' | 'deadline' | 'created' | 'category'>('deadline');

  // Group state
  const [openGroups, setOpenGroups] = useState<{ [key: string]: boolean }>({});

  // Drag and drop state
  const [draggedTodoId, setDraggedTodoId] = useState<string | null>(null);
  const [dragOverTodoId, setDragOverTodoId] = useState<string | null>(null);
  const [dropIndicatorPosition, setDropIndicatorPosition] = useState<{ id: string | null, position: 'top' | 'bottom' | null }>({ id: null, position: null });

  // Fuse.js search setup
  const fuse = useMemo(() => {
    return todoItems.length
      ? new Fuse(todoItems, {
          keys: ["name", "note", "category"],
          threshold: 0.3,
          ignoreLocation: true,
        })
      : null;
  }, [todoItems]);

  // Filtered items based on search
  const filteredTodoItems = useMemo(() => {
    if (!todoSearchQuery.trim()) return todoItems;
    if (!fuse) return todoItems;
    return fuse.search(todoSearchQuery).map((result) => result.item);
  }, [todoSearchQuery, fuse, todoItems]);

  // Group tasks by deadline
  const groupedTasks = useMemo(() => {
    const groups: { [key: string]: TodoItem[] } = {};
    filteredTodoItems.forEach((item: TodoItem) => {
      const group = getTaskGroup(item.deadline);
      if (!groups[group]) groups[group] = [];
      groups[group].push(item);
    });

    // Sort tasks within each group by deadline
    Object.keys(groups).forEach(group => {
      groups[group].sort((a: TodoItem, b: TodoItem) => {
        if (!a.deadline) return 1; // Move items without deadline to the end
        if (!b.deadline) return -1;
        return a.deadline.getTime() - b.deadline.getTime();
      });
    });

    // Define the order of groups
    const groupOrder = [
      'Overdue',
      'Today',
      'Tomorrow',
      'This Week',
      'Next Week',
      'This Month',
      'Next Month',
      'Later',
      'No date yet'
    ];

    // Create a new object with ordered groups
    const orderedGroups: { [key: string]: TodoItem[] } = {};
    groupOrder.forEach(group => {
      if (groups[group]) {
        orderedGroups[group] = groups[group];
      }
    });

    return orderedGroups;
  }, [filteredTodoItems]);

  // Toggle group accordion
  const toggleGroup = useCallback((group: string) => {
    setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }));
  }, []);

  // Keyboard shortcuts for calendar view
  useEffect(() => {
    if (viewMode !== 'calendar') return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'm' || e.key === 'M') setCalendarViewMode('month');
      if (e.key === 'w' || e.key === 'W') setCalendarViewMode('week');
      if (e.key === 'd' || e.key === 'D') setCalendarViewMode('day');
      if (e.key === 'y' || e.key === 'Y') setCalendarViewMode('year');
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, setCalendarViewMode, calendarViewMode]);

  // Calendar navigation functions
  const navigateCalendar = useCallback((direction: 'prev' | 'next') => {
    const d = new Date(calendarDate);
    if (direction === 'prev') {
      if (calendarViewMode === 'month') d.setMonth(d.getMonth() - 1);
      else if (calendarViewMode === 'week') d.setDate(d.getDate() - 7);
      else if (calendarViewMode === 'day') d.setDate(d.getDate() - 1);
      else if (calendarViewMode === 'year') d.setFullYear(d.getFullYear() - 1);
    } else {
      if (calendarViewMode === 'month') d.setMonth(d.getMonth() + 1);
      else if (calendarViewMode === 'week') d.setDate(d.getDate() + 7);
      else if (calendarViewMode === 'day') d.setDate(d.getDate() + 1);
      else if (calendarViewMode === 'year') d.setFullYear(d.getFullYear() + 1);
    }
    setCalendarDate(d);
  }, [calendarDate, calendarViewMode]);

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, id: string) => {
    console.log('Drag start:', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTodoId(id);
    e.currentTarget.classList.add('opacity-50', 'border-dashed', 'border-2', 'border-[#A85C36]');
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>, id: string) => {
    e.preventDefault();
    console.log('Drag enter:', id);
    if (draggedTodoId !== id) {
      setDragOverTodoId(id);
    }
  }, [draggedTodoId]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    console.log('Drag leave');
    e.currentTarget.classList.remove('bg-[#EBE3DD]');
    setDragOverTodoId(null);
    setDropIndicatorPosition({ id: null, position: null });
  }, []);

  const handleItemDragOver = useCallback((e: React.DragEvent<HTMLDivElement>, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (draggedTodoId === id) {
      setDropIndicatorPosition({ id: null, position: null });
      setDragOverTodoId(null);
      return;
    }

    setDragOverTodoId(id);

    const rect = e.currentTarget.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    const halfHeight = rect.height / 2;

    if (mouseY < halfHeight) {
      setDropIndicatorPosition({ id: id, position: 'top' });
    } else {
      setDropIndicatorPosition({ id: id, position: 'bottom' });
    }
  }, [draggedTodoId]);

  const handleDragEnd = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    console.log('Drag end');
    setDraggedTodoId(null);
    setDragOverTodoId(null);
    setDropIndicatorPosition({ id: null, position: null });
    e.currentTarget.classList.remove('opacity-50', 'border-dashed', 'border-2', 'border-[#A85C36]');
  }, []);

  const handleListDrop = useCallback((e: React.DragEvent<HTMLDivElement>, targetListId: string) => {
    e.preventDefault();
    console.log('List drop:', targetListId);
    // This would need to be handled by the parent component
    setDraggedTodoId(null);
    setDragOverTodoId(null);
    setDropIndicatorPosition({ id: null, position: null });
  }, []);

  return {
    // Search state
    todoSearchQuery,
    setTodoSearchQuery,

    // View mode state
    viewMode,
    setViewMode,
    calendarViewMode,
    setCalendarViewMode,
    calendarDate,
    setCalendarDate,

    // Filter state
    showCompletedTasks,
    setShowCompletedTasks,
    showCompletedItems,
    setShowCompletedItems,

    // Sort state
    sortBy,
    setSortBy,

    // Group state
    openGroups,
    setOpenGroups,

    // Drag and drop state
    draggedTodoId,
    setDraggedTodoId,
    dragOverTodoId,
    setDragOverTodoId,
    dropIndicatorPosition,
    setDropIndicatorPosition,

    // Computed values
    filteredTodoItems,
    groupedTasks,

    // Handlers
    toggleGroup,
    navigateCalendar,
    handleDragStart,
    handleDragEnter,
    handleDragLeave,
    handleItemDragOver,
    handleDragEnd,
    handleListDrop,
    getTaskGroup,
  };
} 