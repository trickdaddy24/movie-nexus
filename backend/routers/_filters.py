from sqlalchemy import or_, select


def apply_category_filter(q, model, genre_model, genre_fk_col, category: str | None):
    """
    Apply a category WHERE clause to a SQLAlchemy select query.

    Args:
        q: the select() query
        model: Movie or TVShow class
        genre_model: Genre (for movies) or ShowGenre (for shows)
        genre_fk_col: Genre.movie_id or ShowGenre.show_id
        category: one of all/usa/foreign/anime/korean/indian/documentary/kids
    """
    if not category or category == "all":
        return q

    if category == "usa":
        return q.where(model.origin_country.like("%US%"))

    if category == "anime":
        return q.join(genre_model).where(
            model.original_language == "ja",
            genre_model.name == "Animation",
        )

    if category == "korean":
        return q.where(model.origin_country.like("%KR%"))

    if category == "indian":
        return q.where(model.origin_country.like("%IN%"))

    if category == "documentary":
        return q.join(genre_model).where(genre_model.name == "Documentary")

    if category == "kids":
        kids_ratings = ["G", "PG", "TV-Y", "TV-Y7", "TV-Y7-FV", "TV-G", "TV-PG"]
        return q.join(genre_model).where(
            model.origin_country.like("%US%"),
            or_(
                model.content_rating.in_(kids_ratings),
                genre_model.name.in_(["Family", "Animation"]),
            ),
        )

    if category == "foreign":
        # Catch-all: not USA/KR/IN and not Anime (ja + Animation genre)
        anime_ids = select(genre_fk_col).where(genre_model.name == "Animation")
        return q.where(
            ~model.origin_country.like("%US%"),
            ~model.origin_country.like("%KR%"),
            ~model.origin_country.like("%IN%"),
            or_(
                model.original_language != "ja",
                ~model.id.in_(anime_ids),
            ),
        )

    return q
