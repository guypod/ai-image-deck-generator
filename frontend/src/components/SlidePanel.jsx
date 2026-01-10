import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import SlideThumbnail from './SlideThumbnail';

export default function SlidePanel({
  slides,
  selectedSlideId,
  onSelectSlide,
  onDeleteSlide,
  onAddSlide,
  onReorderSlides,
  onToggleNoImages,
  deckId,
}) {
  const handleDragEnd = (result) => {
    if (!result.destination) {
      return; // Dropped outside the list
    }

    if (result.source.index === result.destination.index) {
      return; // No change in position
    }

    // Reorder the slides array
    const newSlides = Array.from(slides);
    const [removed] = newSlides.splice(result.source.index, 1);
    newSlides.splice(result.destination.index, 0, removed);

    // Extract slide IDs in new order
    const newSlideIds = newSlides.map(slide => slide.id);

    onReorderSlides(newSlideIds);
  };

  if (slides.length === 0) {
    return (
      <Box
        sx={{
          width: 280,
          height: '100%',
          borderRight: 1,
          borderColor: 'divider',
          bgcolor: 'background.default',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography variant="body2" color="text.secondary" align="center" mb={2}>
          No slides yet
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onAddSlide}
          fullWidth
        >
          Create First Slide
        </Button>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: 280,
        height: '100%',
        borderRight: 1,
        borderColor: 'divider',
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Scrollable Slide List */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: 2,
          '&::-webkit-scrollbar': {
            width: 8,
          },
          '&::-webkit-scrollbar-track': {
            bgcolor: 'background.default',
          },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: 'divider',
            borderRadius: 1,
            '&:hover': {
              bgcolor: 'text.secondary',
            },
          },
        }}
      >
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="slides">
            {(provided, snapshot) => (
              <Box
                ref={provided.innerRef}
                {...provided.droppableProps}
                sx={{
                  minHeight: '100%',
                  bgcolor: snapshot.isDraggingOver ? 'action.hover' : 'transparent',
                  borderRadius: 1,
                  transition: 'background-color 0.2s',
                }}
              >
                {slides.map((slide, index) => (
                  <Draggable key={slide.id} draggableId={slide.id} index={index}>
                    {(provided, snapshot) => (
                      <Box
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                      >
                        <SlideThumbnail
                          slide={slide}
                          slideNumber={index + 1}
                          isSelected={selectedSlideId === slide.id}
                          onSelect={() => onSelectSlide(slide.id)}
                          onDelete={onDeleteSlide}
                          onToggleNoImages={onToggleNoImages}
                          deckId={deckId}
                          isDragging={snapshot.isDragging}
                        />
                      </Box>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </Box>
            )}
          </Droppable>
        </DragDropContext>
      </Box>

      {/* Add Slide Button */}
      <Box
        sx={{
          p: 2,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={onAddSlide}
          fullWidth
        >
          Add Slide
        </Button>
      </Box>
    </Box>
  );
}
