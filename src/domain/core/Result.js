/**
 * @file Result.js
 * Standardized Functional Monad (Result / Either pattern) for resilient error handling without exceptions.
 * Aligned with 2026/2027 Clean Architecture specifications.
 */

export class Result {
  /**
   * @param {boolean} isSuccess
   * @param {any} [value]
   * @param {string|Error|Record<string, any>} [error]
   */
  constructor(isSuccess, value = null, error = null) {
    this.isSuccess = isSuccess;
    this.isFailure = !isSuccess;
    this.value = value;
    this.error = error;
    Object.freeze(this);
  }

  static ok(value) {
    return new Result(true, value, null);
  }

  static fail(error) {
    return new Result(false, null, error);
  }

  /**
   * Pattern matching utility for functional consumption
   * @param {{ ok: (val: any) => any, fail: (err: any) => any }} handlers
   */
  match({ ok, fail }) {
    return this.isSuccess ? ok(this.value) : fail(this.error);
  }

  /**
   * Safely maps the success value
   */
  map(fn) {
    if (this.isFailure) return this;
    try {
      return Result.ok(fn(this.value));
    } catch (err) {
      return Result.fail(err);
    }
  }

  /**
   * Unwraps the value or throws the contained error
   */
  unwrap() {
    if (this.isFailure) {
      throw this.error instanceof Error ? this.error : new Error(String(this.error));
    }
    return this.value;
  }
}
