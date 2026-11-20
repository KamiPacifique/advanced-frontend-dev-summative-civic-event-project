import express from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { uploadPromoVideo } from '../middlewares/upload.middleware.js';
import { body } from 'express-validator';
import * as controller from '../controllers/promos.controller.js';
import validateBody from '../middlewares/validateBody.middleware.js';

const router = express.Router();

// Captions are required for uploaded videos, but optional when the promo uses
// an external video link (YouTube/Vimeo players provide their own captions).
const captionRule = body('caption_text')
    .if((value, { req }) => req.file || !req.body.video_link)
    .notEmpty().withMessage('Caption text is required');

// Public (authenticated users)
router.get('/', authenticate, controller.list);
router.get('/:id', authenticate, controller.get);

// Admin-only routes
router.post(
    '/',
    authenticate,
    authorize(['admin']),
    uploadPromoVideo.single('video'),
    [
        body('title').notEmpty().withMessage('Title is required'),
        body('description').notEmpty().withMessage('Description is required'),
        captionRule
    ],
    validateBody,
    controller.create
);

router.put(
    '/:id',
    authenticate,
    authorize(['admin']),
    uploadPromoVideo.single('video'),
    [
        body('title').notEmpty().withMessage('Title is required'),
        body('description').notEmpty().withMessage('Description is required'),
        captionRule
    ],
    validateBody,
    controller.update
);

router.patch('/:id/publish', authenticate, authorize(['admin']), controller.publishPromo);
router.patch('/:id/unpublish', authenticate, authorize(['admin']), controller.unpublishPromo);
router.delete('/:id', authenticate, authorize(['admin']), controller.remove);

export default router;
