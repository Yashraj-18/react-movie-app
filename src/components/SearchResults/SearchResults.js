import { useEffect, useState, useRef, useCallback } from 'react';
import FilterBar from '../FilterBar/FilterBar';
import requests from '../../request';
import './SearchResults.css';

const SearchResults = ({ query, onClose }) => {
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [filters, setFilters] = useState({
    genres: [],
    yearRange: [1900, new Date().getFullYear()],
    ratingRange: [0, 10],
    sortBy: 'relevance'
  });
  const [favorites, setFavorites] = useState(() => {
    const savedFavorites = localStorage.getItem('favoriteMovies');
    return savedFavorites ? JSON.parse(savedFavorites) : [];
  });
  const observer = useRef();
  const abortControllerRef = useRef(null);
  const maxRetries = 3;

  // Save favorites to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('favoriteMovies', JSON.stringify(favorites));
  }, [favorites]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Reset state when query or filters change
  useEffect(() => {
    setResults([]);
    setPage(1);
    setHasMore(true);
    setError(null);
    setRetryCount(0);
  }, [debouncedQuery, filters]);

  // Intersection Observer setup
  const lastResultRef = useCallback(node => {
    if (loading) return;
    
    if (observer.current) {
      observer.current.disconnect();
    }

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        setPage(prevPage => prevPage + 1);
      }
    }, {
      root: null,
      rootMargin: '100px',
      threshold: 0.1
    });

    if (node) {
      observer.current.observe(node);
    }
  }, [loading, hasMore]);

  const fetchResults = useCallback(async () => {
    if (!debouncedQuery) return;
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        requests.fetchSearch(debouncedQuery) + `&page=${page}`,
        { signal: abortControllerRef.current.signal }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      setResults(prevResults => {
        const newResults = data.results.filter(
          newResult => !prevResults.some(prevResult => prevResult.id === newResult.id)
        );
        
        if (page === 1) return newResults;
        return [...prevResults, ...newResults];
      });
      
      setHasMore(data.page < data.total_pages);
      setRetryCount(0); // Reset retry count on successful fetch
    } catch (error) {
      if (error.name === 'AbortError') return;
      
      console.error('Error fetching search results:', error);
      
      if (retryCount < maxRetries) {
        setRetryCount(prev => prev + 1);
        setError(`Failed to load results. Retrying (${retryCount + 1}/${maxRetries})...`);
        
        // Exponential backoff for retries
        const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 10000);
        setTimeout(() => {
          fetchResults();
        }, backoffDelay);
      } else {
        setError('Failed to load results after multiple attempts. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, page, retryCount]);

  // Fetch results
  useEffect(() => {
    fetchResults();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchResults]);

  const handleRetry = () => {
    setRetryCount(0);
    setError(null);
    fetchResults();
  };

  const toggleFavorite = (movie) => {
    setFavorites(prev => {
      const isFavorite = prev.some(fav => fav.id === movie.id);
      if (isFavorite) {
        return prev.filter(fav => fav.id !== movie.id);
      } else {
        return [...prev, movie];
      }
    });
  };

  const isFavorite = (movieId) => {
    return favorites.some(fav => fav.id === movieId);
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="search-results" role="dialog" aria-label="Search Results">
      <div className="search-results__header">
        <h3>Search Results for "{debouncedQuery}"</h3>
        <button 
          className="search-results__close" 
          onClick={onClose}
          aria-label="Close search results"
        >
          <i className="fas fa-times"></i>
        </button>
      </div>

      <FilterBar onFilterChange={setFilters} />
      
      <div className="search-results__content">
        {error && (
          <div className="search-results__error">
            <i className="fas fa-exclamation-circle"></i>
            {error}
            {retryCount >= maxRetries && (
              <button 
                className="search-results__retry"
                onClick={handleRetry}
                aria-label="Retry search"
              >
                <i className="fas fa-redo"></i> Retry
              </button>
            )}
          </div>
        )}

        {results.map((result, index) => (
          <div
            key={result.id}
            ref={index === results.length - 1 ? lastResultRef : null}
            className="search-result-item"
            role="article"
          >
            <img 
              src={`https://image.tmdb.org/t/p/w500${result.poster_path}`}
              alt={`Poster for ${result.title}`}
              className="search-result-item__poster"
              loading={index < 4 ? "eager" : "lazy"}
            />
            <div className="search-result-item__info">
              <div className="search-result-item__header">
                <h4>{result.title}</h4>
                <button
                  className={`search-result-item__favorite ${isFavorite(result.id) ? 'active' : ''}`}
                  onClick={() => toggleFavorite(result)}
                  aria-label={isFavorite(result.id) ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <i className={`fas fa-heart ${isFavorite(result.id) ? 'fas' : 'far'}`}></i>
                </button>
              </div>
              <p>{result.overview}</p>
              <div className="search-result-item__meta">
                <span>{result.release_date}</span>
                <span>{result.vote_average}/10</span>
              </div>
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="search-results__loading" role="status" aria-label="Loading more results">
            <i className="fas fa-spinner fa-spin"></i>
            Loading more results...
          </div>
        )}
        
        {!hasMore && results.length > 0 && (
          <div className="search-results__end">
            No more results to load
          </div>
        )}
        
        {!loading && !error && results.length === 0 && (
          <div className="search-results__empty">
            No results found for "{debouncedQuery}"
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchResults; 