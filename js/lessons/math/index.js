/**
 * Math lessons, one module per grade.
 *
 * Split by grade rather than kept in one file because math topics are
 * grade-specific — there are 47 of them — and a single module would be
 * thousands of lines covering nine unrelated syllabi. A grade is the unit
 * anyone actually works on.
 *
 * Grades with no module yet simply contribute nothing; their topics appear in
 * the catalogue marked בקרוב.
 */
import { grade1Lessons } from './grade1.js';
import { grade2Lessons } from './grade2.js';
import { grade3Lessons } from './grade3.js';
import { grade4Lessons } from './grade4.js';
import { grade5Lessons } from './grade5.js';
import { grade6Lessons } from './grade6.js';
import { grade7Lessons } from './grade7.js';
import { grade8Lessons } from './grade8.js';
import { grade9Lessons } from './grade9.js';
import { grade10Lessons } from './grade10.js';
import { grade11Lessons } from './grade11.js';
import { grade12Lessons } from './grade12.js';

export const mathLessons = [
  ...grade1Lessons,
  ...grade2Lessons,
  ...grade3Lessons,
  ...grade4Lessons,
  ...grade5Lessons,
  ...grade6Lessons,
  ...grade7Lessons,
  ...grade8Lessons,
  ...grade9Lessons,
  ...grade10Lessons,
  ...grade11Lessons,
  ...grade12Lessons
];
