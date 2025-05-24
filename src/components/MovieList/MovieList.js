import { useState, useEffect, useRef, useCallback } from 'react';
import { API_KEY, BASE_URL, IMAGE_BASE_URL } from '../../config';
import './MovieList.css';

const MovieList = ({ selectedGenre, isMyList = false }) => {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [layout, setLayout] = useState('grid'); // 'grid' or 'row'
  const [genres, setGenres] = useState({});
  const [likedMovies, setLikedMovies] = useState(() => {
    const saved = localStorage.getItem('likedMovies');
    return saved ? JSON.parse(saved) : [];
  });
  const [dislikedMovies, setDislikedMovies] = useState(() => {
    const saved = localStorage.getItem('dislikedMovies');
    return saved ? JSON.parse(saved) : [];
  });
  const [myListMovies, setMyListMovies] = useState(() => {
    const saved = localStorage.getItem('myListMovies');
    return saved ? JSON.parse(saved) : [];
  });
  const observer = useRef();
  const maxRetries = 3;

  useEffect(() => {
    localStorage.setItem('likedMovies', JSON.stringify(likedMovies));
  }, [likedMovies]);

  useEffect(() => {
    localStorage.setItem('dislikedMovies', JSON.stringify(dislikedMovies));
  }, [dislikedMovies]);

  useEffect(() => {
    localStorage.setItem('myListMovies', JSON.stringify(myListMovies));
  }, [myListMovies]);

  const fetchGenres = async () => {
    try {
      const response = await fetch(
        `${BASE_URL}/genre/movie/list?api_key=${API_KEY}`
      );
      const data = await response.json();
      if (response.ok) {
        const genreMap = {};
        data.genres.forEach(genre => {
          genreMap[genre.id] = genre.name;
        });
        setGenres(genreMap);
      }
    } catch (err) {
      console.error('Error fetching genres:', err);
    }
  };

  const fetchMovies = async (pageNum = 1, append = false) => {
    try {
      setLoading(true);
      setError(null);

      if (isMyList) {
        // For My List, use the stored movies
        const savedMovies = JSON.parse(localStorage.getItem('myListMovies') || '[]');
        setMovies(savedMovies);
        setLoading(false);
        setHasMore(false);
        return;
      }

      const url = selectedGenre
        ? `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=${selectedGenre}&page=${pageNum}`
        : `${BASE_URL}/trending/movie/week?api_key=${API_KEY}&page=${pageNum}`;

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.status_message || 'Failed to fetch movies');
      }

      if (!data.results || !Array.isArray(data.results)) {
        throw new Error('Invalid response format');
      }

      setMovies(prevMovies => append ? [...prevMovies, ...data.results] : data.results);
      setHasMore(data.page < data.total_pages);
      setLoading(false);
      setRetryCount(0);
    } catch (err) {
      console.error('Error fetching movies:', err);
      setError(err.message);
      setLoading(false);

      if (retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000;
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          fetchMovies(pageNum, append);
        }, delay);
      }
    }
  };

  useEffect(() => {
    fetchGenres();
  }, []);

  useEffect(() => {
    setPage(1);
    setMovies([]);
    fetchMovies(1, false);
  }, [selectedGenre, isMyList]);

  const lastMovieElementRef = useCallback(node => {
    if (loading || isMyList) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
        fetchMovies(page + 1, true);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, hasMore, page, isMyList]);

  const handleRetry = () => {
    setRetryCount(0);
    setError(null);
    fetchMovies(page);
  };

  const toggleLayout = () => {
    setLayout(prev => prev === 'grid' ? 'row' : 'grid');
  };

  const handlePlayClick = (movieId) => {
    // TODO: Implement play functionality
    console.log('Play movie:', movieId);
  };

  const toggleLike = (movie) => {
    const isLiked = myListMovies.some(m => m.id === movie.id);
    
    if (isLiked) {
      // Remove from My List
      const updatedList = myListMovies.filter(m => m.id !== movie.id);
      setMyListMovies(updatedList);
      localStorage.setItem('myListMovies', JSON.stringify(updatedList));
    } else {
      // Add to My List
      const updatedList = [...myListMovies, movie];
      setMyListMovies(updatedList);
      localStorage.setItem('myListMovies', JSON.stringify(updatedList));
    }
  };

  const toggleDislike = (movieId) => {
    // Remove from My List if it exists
    const updatedList = myListMovies.filter(m => m.id !== movieId);
    setMyListMovies(updatedList);
    localStorage.setItem('myListMovies', JSON.stringify(updatedList));
  };

  const removeFromMyList = (movieId) => {
    const updatedList = myListMovies.filter(m => m.id !== movieId);
    setMyListMovies(updatedList);
    localStorage.setItem('myListMovies', JSON.stringify(updatedList));
  };

  const isLiked = (movieId) => myListMovies.some(m => m.id === movieId);
  const isDisliked = (movieId) => false; // Dislike functionality removed for simplicity

  if (error) {
    return (
      <div className="movie-list__error">
        <i className="fas fa-exclamation-circle"></i>
        <span>{error}</span>
        {retryCount >= maxRetries && (
          <button className="movie-list__retry-button" onClick={handleRetry}>
            <i className="fas fa-redo"></i>
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="movie-list">
      <div className="movie-list__header">
        <h2 className="movie-list__title">
          {isMyList ? 'My List' : selectedGenre ? 'Movies by Genre' : 'Trending Movies'}
        </h2>
        <button className="movie-list__layout-toggle" onClick={toggleLayout}>
          <i className={`fas fa-${layout === 'grid' ? 'th-large' : 'list'}`}></i>
        </button>
      </div>
      <div className={`movie-list__container ${layout}`}>
        {movies.map((movie, index) => (
          <div
            key={movie.id}
            ref={index === movies.length - 1 ? lastMovieElementRef : null}
            className="movie-card"
          >
            <div className="movie-card__poster">
              <img
                src={`${IMAGE_BASE_URL}/w500${movie.poster_path}`}
                alt={movie.title}
                onError={(e) => {
                  e.target.src = 'https://via.placeholder.com/500x750?text=No+Image';
                }}
              />
              <div className="movie-card__overlay">
                <div className="movie-card__info">
                  <h3 className="movie-card__title">{movie.title}</h3>
                  <p className="movie-card__year">
                    {new Date(movie.release_date).getFullYear()}
                  </p>
                  <div className="movie-card__rating">
                    <i className="fas fa-star"></i>
                    <span>{movie.vote_average.toFixed(1)}</span>
                  </div>
                </div>
              </div>
              <div className="movie-card__actions">
                <button
                  className={`movie-card__action movie-card__like ${isLiked(movie.id) ? 'active' : ''}`}
                  onClick={() => toggleLike(movie)}
                  aria-label={isLiked(movie.id) ? 'Remove from My List' : 'Add to My List'}
                >
                  <i className={`fas fa-heart ${isLiked(movie.id) ? 'fas' : 'far'}`}></i>
                </button>
                <button
                  className={`movie-card__action movie-card__dislike ${isDisliked(movie.id) ? 'active' : ''}`}
                  onClick={() => toggleDislike(movie.id)}
                  aria-label={isDisliked(movie.id) ? 'Remove dislike' : 'Dislike movie'}
                >
                  <i className={`fas fa-thumbs-down ${isDisliked(movie.id) ? 'fas' : 'far'}`}></i>
                </button>
                <button
                  className="movie-card__play"
                  onClick={() => handlePlayClick(movie.id)}
                >
                  <i className="fas fa-play"></i>
                </button>
              </div>
              <div className="movie-card__genres">
                {movie.genre_ids.slice(0, 3).map(genreId => (
                  <span key={genreId} className="movie-card__genre">
                    {genres[genreId]}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      {loading && (
        <div className="movie-list__loading">
          <i className="fas fa-spinner fa-spin"></i>
          <span>Loading more movies...</span>
        </div>
      )}
      {!loading && isMyList && movies.length === 0 && (
        <div className="movie-list__empty">
          <i className="fas fa-heart-broken"></i>
          <span>Your list is empty. Like some movies to add them here!</span>
        </div>
      )}
    </div>
  );
};

export default MovieList; 