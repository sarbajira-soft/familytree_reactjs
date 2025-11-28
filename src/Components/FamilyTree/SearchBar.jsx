import React, { useState, useEffect, useRef } from 'react';
import { FaSearch, FaTimes, FaChevronUp, FaChevronDown, FaUser } from 'react-icons/fa';

const SearchBar = ({ 
    tree, 
    onSearchResults, 
    onFocusPerson, 
    onClearSearch,
    language = 'english' 
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [currentResultIndex, setCurrentResultIndex] = useState(-1);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const searchInputRef = useRef(null);
    const resultsRef = useRef(null);
    const [isMobile, setIsMobile] = useState(false);

    // Track viewport for mobile vs desktop behavior
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 640);
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Perform search when query changes or show all when empty
    useEffect(() => {
        if (!tree) {
            setSearchResults([]);
            setCurrentResultIndex(-1);
            setShowResults(false);
            if (onSearchResults) onSearchResults([]);
            return;
        }

        const query = searchQuery.toLowerCase().trim();
        const results = [];

        // If search is empty, prepare all family members but don't auto-open dropdown
        if (!query) {
            tree.people.forEach((person, personId) => {
                const name = person.name || '';
                const firstName = person.firstName || '';
                const lastName = person.lastName || '';
                const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
                
                results.push({
                    id: personId,
                    person: person,
                    displayName: name || fullName || 'Unnamed Member',
                    matchType: 'all'
                });
            });
            
            // Sort alphabetically when showing all
            results.sort((a, b) => a.displayName.localeCompare(b.displayName));
            setShowResults(false);
        } else {
            // Search through all people in the tree
            tree.people.forEach((person, personId) => {
                const name = person.name || '';
                const firstName = person.firstName || '';
                const lastName = person.lastName || '';
                const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
                
                // Check if any name field matches the search query (partial match)
                const nameMatches = name.toLowerCase().includes(query) ||
                                   firstName.toLowerCase().includes(query) ||
                                   lastName.toLowerCase().includes(query) ||
                                   fullName.toLowerCase().includes(query);

                if (nameMatches) {
                    results.push({
                        id: personId,
                        person: person,
                        displayName: name || fullName || 'Unnamed Member',
                        matchType: 'search'
                    });
                }
            });

            // Sort results by relevance (exact matches first, then partial matches)
            results.sort((a, b) => {
                const aName = a.displayName.toLowerCase();
                const bName = b.displayName.toLowerCase();
                
                // Exact matches first
                if (aName === query && bName !== query) return -1;
                if (bName === query && aName !== query) return 1;
                
                // Starts with query
                if (aName.startsWith(query) && !bName.startsWith(query)) return -1;
                if (bName.startsWith(query) && !aName.startsWith(query)) return 1;
                
                // Alphabetical order for same relevance
                return aName.localeCompare(bName);
            });

            setShowResults(results.length > 0);
        }

        setSearchResults(results);
        setCurrentResultIndex(results.length > 0 ? 0 : -1);
        
        if (onSearchResults) onSearchResults(results);
    }, [searchQuery, tree]);

    // Handle search input change
    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
    };

    // Clear search
    const handleClearSearch = () => {
        setSearchQuery('');
        setSearchResults([]);
        setCurrentResultIndex(-1);
        setShowResults(false);
        setIsSearchOpen(false);
        if (onClearSearch) onClearSearch();
    };

    // Navigate to next result
    const handleNextResult = () => {
        if (searchResults.length === 0) return;
        const nextIndex = (currentResultIndex + 1) % searchResults.length;
        setCurrentResultIndex(nextIndex);
        focusOnResult(nextIndex);
    };

    // Navigate to previous result
    const handlePrevResult = () => {
        if (searchResults.length === 0) return;
        const prevIndex = currentResultIndex === 0 ? searchResults.length - 1 : currentResultIndex - 1;
        setCurrentResultIndex(prevIndex);
        focusOnResult(prevIndex);
    };

    // Focus on a specific result
    const focusOnResult = (index) => {
        if (index >= 0 && index < searchResults.length) {
            const result = searchResults[index];
            if (onFocusPerson) {
                onFocusPerson(result.id, result.person);
            }
        }
    };

    // Handle result item click
    const handleResultClick = (index) => {
        // Directly focus on the clicked result without relying on state update
        if (index >= 0 && index < searchResults.length) {
            const result = searchResults[index];
            if (onFocusPerson) {
                onFocusPerson(result.id, result.person);
            }
        }
        setCurrentResultIndex(index);
        setShowResults(false);
    };

    // Handle keyboard navigation
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (searchResults.length > 0 && currentResultIndex >= 0) {
                focusOnResult(currentResultIndex);
                setShowResults(false);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            handleNextResult();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            handlePrevResult();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setShowResults(false);
            searchInputRef.current?.blur();
        }
    };

    // Toggle search bar
    const toggleSearch = () => {
        setIsSearchOpen(!isSearchOpen);
        if (!isSearchOpen) {
            setTimeout(() => {
                searchInputRef.current?.focus();
                // Populate and show all results when opening search
                if (tree && tree.people.size > 0) {
                    // Force repopulate search results by triggering the search logic
                    const results = [];
                    tree.people.forEach((person, personId) => {
                        const name = person.name || '';
                        const firstName = person.firstName || '';
                        const lastName = person.lastName || '';
                        const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
                        
                        results.push({
                            id: personId,
                            person: person,
                            displayName: name || fullName || 'Unnamed Member',
                            matchType: 'all'
                        });
                    });
                    
                    // Sort alphabetically when showing all
                    results.sort((a, b) => a.displayName.localeCompare(b.displayName));
                    
                    setSearchResults(results);
                    setCurrentResultIndex(results.length > 0 ? 0 : -1);
                    setShowResults(true);
                    
                    if (onSearchResults) onSearchResults(results);
                }
            }, 100);
        } else {
            handleClearSearch();
        }
    };

    // Close results when clicking outside (desktop dropdown)
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                resultsRef.current &&
                !resultsRef.current.contains(event.target) &&
                searchInputRef.current &&
                !searchInputRef.current.contains(event.target)
            ) {
                setShowResults(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // --- Render ---

    if (isMobile) {
        return (
            <div className="relative inline-block">
                {/* Mobile: circular search button opens fullscreen modal */}
                <button
                    onClick={toggleSearch}
                    className="w-10 h-10 bg-blue-600 border-2 border-blue-600 text-white rounded-full hover:bg-blue-700 font-semibold active:scale-95 transition-all duration-200 shadow-md flex items-center justify-center"
                    title="Search family members"
                >
                    <FaSearch className="text-sm" />
                </button>

                {isSearchOpen && (
                    <>
                        <div
                            className="fixed inset-0 bg-black/50 z-[9998]"
                            onClick={handleClearSearch}
                        />
                        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                            <div
                                ref={resultsRef}
                                className="flex flex-col gap-3 bg-white rounded-xl shadow-lg border border-gray-200 p-4 w-full max-w-md max-h-[75vh] overflow-hidden"
                            >
                                {/* Search Input */}
                                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-full">
                                    <FaSearch className="text-blue-500 text-sm" />
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        value={searchQuery}
                                        onChange={handleSearchChange}
                                        onKeyDown={handleKeyDown}
                                        onFocus={() => {
                                            if (tree && tree.people.size > 0) {
                                                setShowResults(true);
                                            }
                                        }}
                                        placeholder={language === 'tamil' ? 'குடும்ப உறுப்பினர்களைத் தேடுங்கள்...' : 'Search family members...'}
                                        className="flex-1 px-2 py-0.5 bg-transparent border-none outline-none text-gray-700 placeholder-gray-400 text-sm"
                                        autoComplete="off"
                                    />
                                    <button
                                        onClick={handleClearSearch}
                                        className="p-1.5 hover:bg-red-50 rounded-full text-gray-400 hover:text-red-500 transition-all duration-200"
                                        title="Close"
                                    >
                                        <FaTimes className="text-sm" />
                                    </button>
                                </div>

                                {/* Search Results */}
                                {showResults && searchResults.length > 0 && (
                                    <div className="flex flex-col overflow-hidden rounded-lg border border-gray-200 mt-1">
                                        <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
                                            <span className="text-[11px] sm:text-xs font-medium text-gray-700">
                                                {!searchQuery.trim()
                                                    ? (language === 'tamil'
                                                        ? `அனைத்து குடும்ப உறுப்பினர்கள் (${searchResults.length})`
                                                        : `All Family Members (${searchResults.length})`)
                                                    : `${searchResults.length} ${language === 'tamil' ? 'முடிவுகள்' : 'results'} found`}
                                            </span>
                                        </div>
                                        <div className="overflow-y-auto max-h-64">
                                            {searchResults.map((result, index) => (
                                                <div
                                                    key={result.id}
                                                    onClick={() => handleResultClick(index)}
                                                    className={`flex items-center p-2 sm:p-2.5 hover:bg-blue-50 cursor-pointer transition-all duration-200 border-b border-gray-100 last:border-b-0 ${
                                                        index === currentResultIndex
                                                            ? 'bg-gradient-to-r from-blue-100 to-indigo-100 border-blue-300 shadow-sm'
                                                            : ''
                                                    }`}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-semibold text-gray-900 truncate text-xs sm:text-sm">
                                                            {result.displayName}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        );
    }

    // Desktop: inline search in the header
    return (
        <div className="relative inline-flex flex-col w-40">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-600 rounded-md shadow-sm">
                <FaSearch className="text-blue-500 text-xs" />
                <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                        if (tree && tree.people.size > 0) {
                            setShowResults(true);
                        }
                    }}
                    placeholder={language === 'tamil' ? 'குடும்ப உறுப்பினர்களைத் தேடுங்கள்...' : 'Search family members...'}
                    className="flex-1 px-1 py-0.5 bg-transparent border-none outline-none text-gray-700 placeholder-gray-400 text-xs"
                    autoComplete="off"
                />
                {searchQuery && (
                    <button
                        onClick={handleClearSearch}
                        className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-all duration-200"
                        title="Clear"
                    >
                        <FaTimes className="text-xs" />
                    </button>
                )}
            </div>

            {showResults && searchResults.length > 0 && (
                <div
                    ref={resultsRef}
                    className="absolute z-[60] top-full mt-2 w-full bg-white rounded-lg shadow-lg border border-gray-200"
                >
                    <div className="px-3 py-1.5 border-b border-gray-200 bg-gray-50">
                        <span className="text-[10px] sm:text-[11px] font-medium text-gray-700">
                            {!searchQuery.trim()
                                ? (language === 'tamil'
                                    ? `அனைத்து குடும்ப உறுப்பினர்கள் (${searchResults.length})`
                                    : `All Family Members (${searchResults.length})`)
                                : `${searchResults.length} ${language === 'tamil' ? 'முடிவுகள்' : 'results'} found`}
                        </span>
                    </div>
                    <div className="overflow-y-auto max-h-64">
                        {searchResults.map((result, index) => (
                            <div
                                key={result.id}
                                onClick={() => handleResultClick(index)}
                                className={`flex items-center p-2 sm:p-2.5 hover:bg-blue-50 cursor-pointer transition-all duration-200 border-b border-gray-100 last:border-b-0 ${
                                    index === currentResultIndex
                                        ? 'bg-gradient-to-r from-blue-100 to-indigo-100 border-blue-300 shadow-sm'
                                        : ''
                                }`}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-gray-900 truncate text-xs sm:text-sm">
                                        {result.displayName}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchBar;
