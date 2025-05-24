import { useState, useEffect, useRef } from 'react';
import { API_KEY, BASE_URL } from '../../config';
import './GenreList.css';

const GenreList = ({ onGenreSelect }) => {
  const [genres, setGenres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const response = await fetch(
          `${BASE_URL}/genre/movie/list?api_key=${API_KEY}&language=en-US`
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.status_message || 'Failed to fetch genres');
        }

        setGenres(data.genres);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchGenres();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleGenreClick = (genre) => {
    setSelectedGenre(genre.id);
    onGenreSelect(genre.id);
    setIsOpen(false);
  };

  const handleAllGenresClick = () => {
    setSelectedGenre(null);
    onGenreSelect(null);
    setIsOpen(false);
  };

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  if (loading) {
    return <div className="genre-list__loading">Loading genres...</div>;
  }

  if (error) {
    return <div className="genre-list__error">{error}</div>;
  }

  const selectedGenreName = genres.find(g => g.id === selectedGenre)?.name || 'All Genres';

  return (
    <div className="genre-list" ref={dropdownRef}>
      <button className="genre-list__dropdown-button" onClick={toggleDropdown}>
        <i className="fas fa-film nav__icon"></i>
        <span>{selectedGenreName}</span>
        <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'}`}></i>
      </button>
      {isOpen && (
        <div className="genre-list__dropdown">
          <button
            className={`genre-list__item ${selectedGenre === null ? 'active' : ''}`}
            onClick={handleAllGenresClick}
          >
            <i className="fas fa-th-large nav__icon"></i>
            <span>All Genres</span>
          </button>
          {genres.map((genre) => (
            <button
              key={genre.id}
              className={`genre-list__item ${selectedGenre === genre.id ? 'active' : ''}`}
              onClick={() => handleGenreClick(genre)}
            >
              <i className="fas fa-film nav__icon"></i>
              <span>{genre.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default GenreList; 