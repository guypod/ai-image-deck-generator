import pLimit from 'p-limit';

/**
 * Async Pool Utility
 * Manages parallel execution with concurrency limiting
 */

// Default concurrency limit (can be overridden by environment variable)
const DEFAULT_CONCURRENCY = parseInt(process.env.MAX_CONCURRENT_GENERATIONS) || 5;

/**
 * Execute tasks in parallel with concurrency limit
 * @param {Array<Function>} tasks - Array of async functions to execute
 * @param {number} concurrency - Max number of concurrent executions
 * @returns {Promise<Array>} - Array of results with status
 */
export async function executeInParallel(tasks, concurrency = DEFAULT_CONCURRENCY) {
  const limit = pLimit(concurrency);
  const results = [];

  // Wrap each task with limit and error handling
  const promises = tasks.map((task, index) =>
    limit(async () => {
      try {
        const result = await task();
        return {
          index,
          status: 'success',
          data: result,
          error: null
        };
      } catch (error) {
        return {
          index,
          status: 'failed',
          data: null,
          error: error.message || 'Unknown error'
        };
      }
    })
  );

  // Wait for all tasks to complete
  const completedResults = await Promise.all(promises);

  // Sort by original index to maintain order
  completedResults.sort((a, b) => a.index - b.index);

  return completedResults;
}

/**
 * Execute tasks with progress callback
 * @param {Array<Function>} tasks - Array of async functions
 * @param {Function} onProgress - Callback (completed, total, lastResult)
 * @param {number} concurrency - Max concurrent executions
 * @returns {Promise<Array>} - Array of results
 */
export async function executeWithProgress(tasks, onProgress, concurrency = DEFAULT_CONCURRENCY) {
  const limit = pLimit(concurrency);
  const results = [];
  let completed = 0;
  const total = tasks.length;

  // Wrap each task with progress tracking
  const promises = tasks.map((task, index) =>
    limit(async () => {
      try {
        const result = await task();
        completed++;
        const resultData = {
          index,
          status: 'success',
          data: result,
          error: null
        };

        if (onProgress) {
          onProgress(completed, total, resultData);
        }

        return resultData;
      } catch (error) {
        completed++;
        const resultData = {
          index,
          status: 'failed',
          data: null,
          error: error.message || 'Unknown error'
        };

        if (onProgress) {
          onProgress(completed, total, resultData);
        }

        return resultData;
      }
    })
  );

  // Wait for all tasks
  const completedResults = await Promise.all(promises);

  // Sort by original index
  completedResults.sort((a, b) => a.index - b.index);

  return completedResults;
}

/**
 * Generate images for multiple slides in parallel
 * @param {Array<Object>} slides - Array of slide objects
 * @param {Function} generateFn - Function to generate images for a slide (slideId) => Promise<images>
 * @param {number} concurrency - Max concurrent generations
 * @returns {Promise<Object>} - Results grouped by slide
 */
export async function generateImagesForSlides(slides, generateFn, concurrency = DEFAULT_CONCURRENCY) {
  const tasks = slides.map(slide => async () => {
    return {
      slideId: slide.id,
      result: await generateFn(slide.id)
    };
  });

  const results = await executeInParallel(tasks, concurrency);

  // Transform results into more useful format
  const slideResults = results.map((result, index) => {
    if (result.status === 'success') {
      return {
        slideId: slides[index].id,
        status: 'success',
        images: result.data.result,
        error: null
      };
    } else {
      return {
        slideId: slides[index].id,
        status: 'failed',
        images: null,
        error: result.error
      };
    }
  });

  // Calculate summary
  const summary = {
    total: slideResults.length,
    successful: slideResults.filter(r => r.status === 'success').length,
    failed: slideResults.filter(r => r.status === 'failed').length,
    results: slideResults
  };

  return summary;
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} initialDelay - Initial delay in ms
 * @returns {Promise} - Result of function
 */
export async function retryWithBackoff(fn, maxRetries = 3, initialDelay = 1000) {
  let lastError;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on certain errors
      if (error.message && (
        error.message.includes('API key invalid') ||
        error.message.includes('Content policy violation') ||
        error.message.includes('not found')
      )) {
        throw error;
      }

      // If this was the last attempt, throw
      if (attempt === maxRetries) {
        throw lastError;
      }

      // Wait before retrying (exponential backoff)
      await sleep(delay);
      delay *= 2; // Double the delay each time
    }
  }

  throw lastError;
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Batch process items with a processor function
 * @param {Array} items - Items to process
 * @param {Function} processor - Async function to process each item
 * @param {number} batchSize - Number of items per batch
 * @returns {Promise<Array>} - Processed results
 */
export async function batchProcess(items, processor, batchSize = 10) {
  const results = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(item => processor(item).catch(error => ({ error: error.message })))
    );
    results.push(...batchResults);
  }

  return results;
}

export default {
  executeInParallel,
  executeWithProgress,
  generateImagesForSlides,
  retryWithBackoff,
  batchProcess
};
