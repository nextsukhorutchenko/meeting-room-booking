import type {Clock} from '../../src/lib/time/office-time';

export class TestClock implements Clock {
  constructor(private readonly currentTime: Date) {}

  now(): Date {
    return new Date(this.currentTime);
  }
}
