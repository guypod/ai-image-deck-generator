import React, { useState } from 'react';
import { Box, IconButton, Typography, Checkbox, FormControlLabel, Chip } from '@mui/material';
import { Delete as DeleteIcon, DragIndicator, ImageNotSupported } from '@mui/icons-material';

export default function SlideThumbnail({
  slide,
  slideNumber,
  isSelected,
  onSelect,
  onDelete,
  onToggleNoImages,
  deckId,
  isDragging = false,
}) {
  const [isHovered, setIsHovered] = useState(false);

  const handleDelete = (e) => {
    e.stopPropagation(); // Prevent slide selection
    onDelete(slide.id);
  };

  const handleToggleNoImages = (e) => {
    e.stopPropagation(); // Prevent slide selection
    e.preventDefault(); // Prevent default checkbox behavior
    onToggleNoImages?.(slide.id, slide.noImages);
  };

  // Get thumbnail image URL
  const getThumbnailUrl = () => {
    if (!slide.generatedImages || slide.generatedImages.length === 0) {
      return null;
    }

    // Find pinned image or use first image
    const pinnedImage = slide.generatedImages.find(img => img.isPinned);
    const imageToShow = pinnedImage || slide.generatedImages[0];

    return `/api/decks/${deckId}/slides/${slide.id}/images/${imageToShow.id}`;
  };

  const thumbnailUrl = getThumbnailUrl();

  return (
    <Box
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{
        position: 'relative',
        width: '100%',
        mb: 2,
        cursor: 'pointer',
        borderRadius: 1,
        border: 2,
        borderColor: isSelected ? 'primary.main' : 'divider',
        bgcolor: isSelected ? 'action.selected' : 'background.paper',
        overflow: 'hidden',
        transition: 'all 0.2s',
        opacity: isDragging ? 0.5 : 1,
        '&:hover': {
          borderColor: isSelected ? 'primary.main' : 'primary.light',
          bgcolor: isSelected ? 'action.selected' : 'action.hover',
        },
      }}
    >
      {/* Drag Handle */}
      <Box
        sx={{
          position: 'absolute',
          top: 4,
          left: 4,
          zIndex: 2,
          color: 'text.secondary',
          opacity: isHovered ? 1 : 0,
          transition: 'opacity 0.2s',
          cursor: 'grab',
          '&:active': {
            cursor: 'grabbing',
          },
        }}
        className="drag-handle"
      >
        <DragIndicator fontSize="small" />
      </Box>

      {/* Slide Number Badge */}
      <Box
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 2,
          bgcolor: 'rgba(0, 0, 0, 0.6)',
          color: 'white',
          px: 1,
          py: 0.5,
          borderRadius: 1,
          fontSize: '0.75rem',
          fontWeight: 'bold',
        }}
      >
        {slideNumber}
      </Box>

      {/* Delete Button */}
      {isHovered && (
        <IconButton
          onClick={handleDelete}
          size="small"
          sx={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            zIndex: 2,
            bgcolor: 'error.main',
            color: 'white',
            '&:hover': {
              bgcolor: 'error.dark',
            },
          }}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      )}

      {/* Thumbnail Image or Placeholder */}
      <Box
        sx={{
          width: '100%',
          aspectRatio: '16 / 9',
          bgcolor: thumbnailUrl ? 'black' : 'grey.200',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={`Slide ${slideNumber}`}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <Typography variant="h3" color="text.secondary" fontWeight="bold">
            {slideNumber}
          </Typography>
        )}
      </Box>

      {/* Speaker Notes Preview */}
      {slide.speakerNotes && (
        <Box
          sx={{
            px: 1.5,
            py: 1,
            bgcolor: isSelected ? 'background.paper' : 'background.default',
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {slide.speakerNotes}
          </Typography>
        </Box>
      )}

      {/* No Images Checkbox and Indicator */}
      <Box
        sx={{
          px: 1.5,
          py: 1,
          bgcolor: isSelected ? 'background.paper' : 'background.default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <FormControlLabel
          control={
            <Checkbox
              checked={slide.noImages || false}
              onClick={handleToggleNoImages}
              size="small"
            />
          }
          label={<Typography variant="caption">No images</Typography>}
        />
        {slide.noImages && (
          <Chip
            icon={<ImageNotSupported />}
            label="Text only"
            size="small"
            variant="outlined"
            sx={{ fontSize: '0.65rem', height: 20 }}
          />
        )}
      </Box>
    </Box>
  );
}
