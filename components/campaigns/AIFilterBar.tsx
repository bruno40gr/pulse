"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Sparkles, X } from 'lucide-react';

interface AIFilterBarProps {
    setFilteredContactIds: (ids: string[]) => void;
    setFilterExplanation: (explanation: string) => void;
}

export default function AIFilterBar({ setFilteredContactIds, setFilterExplanation }: AIFilterBarProps) {
  const [query, setQuery] = useState('');
  const [isFiltering, setIsFiltering] = useState(false);

  const handleFilter = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsFiltering(true);
    
    try {
        const response = await fetch('/api/ai-filter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query }),
        });

        if (!response.ok) {
            throw new Error('AI filter request failed');
        }

        const { contact_ids, explanation } = await response.json();
        setFilteredContactIds(contact_ids);
        setFilterExplanation(explanation);

    } catch (error) {
        console.error('Failed to filter contacts with AI:', error);
        // Add user-facing error handling (e.g., a toast)
    } finally {
        setIsFiltering(false);
    }
  };
  
  const clearFilter = () => {
    setQuery('');
    setFilteredContactIds([]);
    setFilterExplanation('');
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            clearFilter();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="p-4 bg-surface rounded-lg mb-4">
        <form onSubmit={handleFilter} className="relative">
            <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
            <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask AI to filter contacts... (e.g., 'all guitar students on Tuesdays')"
                className="w-full pl-10 pr-24 py-2 border border-border rounded-lg focus:ring-primary focus:border-primary"
                disabled={isFiltering}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <Button type="submit" disabled={!query || isFiltering} className="text-xs py-1 px-3">
                {isFiltering ? 'Filtering...' : 'AI Filter'}
                </Button>
            </div>
        </form>
        <button onClick={clearFilter} className="text-xs text-text-muted mt-2 hover:text-text-primary">
            Clear filter
        </button>
    </div>
  );
}