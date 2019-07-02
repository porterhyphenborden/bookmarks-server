const path = require('path');
const express = require('express');
const xss = require('xss');
const logger = require('../logger');
const validUrl = require('valid-url');
const BookmarksService = require('./bookmarks-service');

const bookmarksRouter = express.Router();
const bodyParser = express.json();

const serializeBookmark = bookmark => ({
    id: bookmark.id,
    url: bookmark.url,
    title: xss(bookmark.title),
    description: xss(bookmark.description),
    rating: bookmark.rating
});

bookmarksRouter
    .route('/api/bookmarks')
    .get((req, res, next) => {
        const knexInstance = req.app.get('db');
        BookmarksService.getAllBookmarks(knexInstance)
            .then(bookmarks => {
                res.json(bookmarks.map(serializeBookmark))
        })
    .catch(next)
    })
    .post(bodyParser, (req, res, next) => {
        const knexInstance = req.app.get('db');
        const { title, url, description, rating } = req.body;
        const newBookmark = {
            title,
            url,
            description,
            rating
        };

        for (const [key, value] of Object.entries(newBookmark)) {
            if (value == null) {
                logger.error(`${key} is required.`)
                return res.status(400).json({
                    error: { message: `Missing '${key}' in request body.` }
                })
            }
        }

        const ratingInt = parseInt(rating);

        if (Number.isNaN(ratingInt) || ratingInt < 0 || ratingInt > 5) {
            logger.error(`Invalid rating value ${rating} supplied.`)
            return res
                .status(400)
                .json({
                    error: { message: 'Rating must be a number between 0 and 5.'}
                })
        }

        if (!validUrl.isUri(url)) {
            logger.error(`Invalid url ${url} supplied.`)
            return res
                .status(400)
                .json({
                    error: { message: 'URL must be valid.'}
                })
        }

        BookmarksService.insertBookmark(knexInstance, newBookmark)
            .then(bookmark => {
                res
                    .status(201)
                    .location(path.posix.join(req.originalUrl, `/${bookmark.id}`))
                    .json(serializeBookmark(bookmark))
            })
            .catch(next)
    })


bookmarksRouter
    .route('/api/bookmarks/:id')
    .all((req, res, next) => {
        const knexInstance = req.app.get('db');
        BookmarksService.getById(
            knexInstance,
            req.params.id
        )
        .then(bookmark => {
            if (!bookmark) {
                return res
                    .status(404)
                    .json({
                        error: { message: `Bookmark not found.` }
                    })
            }
            res.bookmark = bookmark;
            next();
        })
        .catch(next)
    })
    .get((req, res, next) => {
        res.json(serializeBookmark(res.bookmark))
    })
    .delete((req, res, next) => {
        const knexInstance = req.app.get('db');
        BookmarksService.deleteBookmark(
            knexInstance,
            req.params.id
        )
        .then(() => {
            res.status(204).end()
        })
        .catch(next)
    })
    .patch(bodyParser, (req, res, next) => {
        const knexInstance = req.app.get('db');
        const { title, url, description, rating } = req.body;
        const bookmarkToUpdate = { title, url, description, rating };

        const numberOfValues = Object.values(bookmarkToUpdate).filter(Boolean).length;
        if (numberOfValues === 0) {
            return res
                .status(400)
                .json({
                    error: {
                        message: `Request body must content either 'title', 'url', 'description, or 'rating'.`
                    }
                })
        }

        BookmarksService.updateBookmark(
            knexInstance, 
            req.params.id,
            bookmarkToUpdate
        )
            .then(numRowsAffected => {
                res.status(204).end()
            })
            .catch(next)
    })

module.exports = bookmarksRouter;