/**
 * Undo/Redo Hook for Dashboard Builder
 * Provides time-travel functionality for dashboard edits
 */

import { useState, useCallback, useRef } from 'react';

export interface HistoryState<T> {
  state: T;
  timestamp: number;
}

export interface UseUndoRedoOptions {
  maxHistory?: number;
}

export function useUndoRedo<T>(
  initialState: T,
  options: UseUndoRedoOptions = {}
) {
  const { maxHistory = 50 } = options;

  const [history, setHistory] = useState<HistoryState<T>[]>([
    { state: initialState, timestamp: Date.now() }
  ]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const isUndoRedoAction = useRef(false);

  const currentState = history[currentIndex]?.state ?? initialState;

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  const pushState = useCallback((newState: T) => {
    if (isUndoRedoAction.current) {
      isUndoRedoAction.current = false;
      return;
    }

    setHistory((prev) => {
      // Remove any future states if we're not at the end
      const newHistory = prev.slice(0, currentIndex + 1);
      
      // Add new state
      newHistory.push({
        state: newState,
        timestamp: Date.now()
      });

      // Limit history size
      if (newHistory.length > maxHistory) {
        return newHistory.slice(newHistory.length - maxHistory);
      }

      return newHistory;
    });

    setCurrentIndex((prev) => {
      const newIndex = Math.min(prev + 1, maxHistory - 1);
      return newIndex;
    });
  }, [currentIndex, maxHistory]);

  const undo = useCallback(() => {
    if (!canUndo) return;
    
    isUndoRedoAction.current = true;
    setCurrentIndex((prev) => prev - 1);
  }, [canUndo]);

  const redo = useCallback(() => {
    if (!canRedo) return;
    
    isUndoRedoAction.current = true;
    setCurrentIndex((prev) => prev + 1);
  }, [canRedo]);

  const reset = useCallback((newInitialState: T) => {
    setHistory([{ state: newInitialState, timestamp: Date.now() }]);
    setCurrentIndex(0);
  }, []);

  const clear = useCallback(() => {
    setHistory([{ state: currentState, timestamp: Date.now() }]);
    setCurrentIndex(0);
  }, [currentState]);

  return {
    state: currentState,
    pushState,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
    clear,
    historyLength: history.length,
    currentIndex
  };
}
