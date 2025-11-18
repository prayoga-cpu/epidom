import { useState, useCallback } from "react";

/**
 * Reusable hook for dialog state management
 *
 * Follows DRY principle by centralizing dialog state logic
 * used across Materials, Products, Recipes, and Suppliers sections
 */
export function useDialogState<T>() {
  const [selectedItem, setSelectedItem] = useState<T | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleView = useCallback((item: T) => {
    setSelectedItem(item);
    setViewDialogOpen(true);
  }, []);

  const handleEdit = useCallback((item: T) => {
    setSelectedItem(item);
    setEditDialogOpen(true);
  }, []);

  const handleDeleteClick = useCallback((item: T) => {
    setSelectedItem(item);
    setDeleteDialogOpen(true);
  }, []);

  const closeAllDialogs = useCallback(() => {
    setViewDialogOpen(false);
    setEditDialogOpen(false);
    setDeleteDialogOpen(false);
    setSelectedItem(null);
  }, []);

  return {
    selectedItem,
    viewDialogOpen,
    editDialogOpen,
    deleteDialogOpen,
    setViewDialogOpen,
    setEditDialogOpen,
    setDeleteDialogOpen,
    setSelectedItem,
    handleView,
    handleEdit,
    handleDeleteClick,
    closeAllDialogs,
  };
}

