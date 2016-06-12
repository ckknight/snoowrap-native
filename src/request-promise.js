import Promise from 'bluebird';
import request from 'browser-request';

function RequestError(cause, options, response) {

    this.name = 'RequestError';
    this.message = String(cause);
    this.cause = cause;
    this.error = cause; // legacy attribute
    this.options = options;
    this.response = response;

    if (Error.captureStackTrace) { // if required for non-V8 envs - see PR #40
        Error.captureStackTrace(this);
    }

}
RequestError.prototype = Object.create(Error.prototype);
RequestError.prototype.constructor = RequestError;


function StatusCodeError(statusCode, body, options, response) {

    this.name = 'StatusCodeError';
    this.statusCode = statusCode;
    this.message = statusCode + ' - ' + (JSON && JSON.stringify ? JSON.stringify(body) : body);
    this.error = body; // legacy attribute
    this.options = options;
    this.response = response;

    if (Error.captureStackTrace) { // if required for non-V8 envs - see PR #40
        Error.captureStackTrace(this);
    }

}
StatusCodeError.prototype = Object.create(Error.prototype);
StatusCodeError.prototype.constructor = StatusCodeError;


function TransformError(cause, options, response) {

    this.name = 'TransformError';
    this.message = String(cause);
    this.cause = cause;
    this.error = cause; // legacy attribute
    this.options = options;
    this.response = response;

    if (Error.captureStackTrace) { // if required for non-V8 envs - see PR #40
        Error.captureStackTrace(this);
    }

}
TransformError.prototype = Object.create(Error.prototype);
TransformError.prototype.constructor = TransformError;

function makeRequest (initialDefaults, moreDefaults, options) {
  return new Promise((resolve, reject) => {
    const fullOptions = {
      ...initialDefaults,
      ...moreDefaults,
      ...options
    };
    if (fullOptions.baseUrl) {
      fullOptions.uri = `${fullOptions.baseUrl}/${fullOptions.uri}`;
      delete fullOptions.baseUrl;
    }
    if (fullOptions.auth) {
      const auth = fullOptions.auth = { ...fullOptions.auth };
      if ('user' in auth) {
        auth.username = auth.user;
        delete auth.user;
      }
      if ('pass' in auth) {
        auth.password = auth.pass;
        delete auth.pass;
      }
      if ('bearer' in auth) {
        const headers = fullOptions.headers = { ...(fullOptions.headers || {}) };
        if (!('authorization' in headers)) {
          headers.authorization = `Bearer ${auth.bearer}`;
        }
      }
    }
    fullOptions.method = (fullOptions.method || 'GET').toUpperCase();
    XMLHttpRequest.prototype.withCredentials = undefined;
    request(fullOptions, (err, response, body) => {
      if (response && !('headers' in response) && 'responseHeaders' in response) {
        response.headers = response.responseHeaders;
      }
      if (!('request' in response)) {
        response.request = fullOptions;
      }
      if (err) {
        reject(new RequestError(err, fullOptions, response));
      } else if (response.statusCode >= 200 && response.statusCode <= 299) {
        if (typeof fullOptions.transform === 'function') {
          resolve(Promise.resolve()
            .then(() => fullOptions.transform(body, response, fullOptions.resolveWithFullResponse))
            .catch(transformErr => {
              throw new TransformError(transformErr, fullOptions, response);
            }));
        } else if (fullOptions.resolveWithFullResponse) {
          resolve(response);
        } else {
          resolve(body);
        }
      } else {
        reject(new StatusCodeError(response.statusCode, body, fullOptions, response));
      }
    });
  });
}

export default {
  defaults: (initialDefaults) => {
    return {
      defaults: (moreDefaults) => {
        return (options) => {
          return makeRequest(initialDefaults, moreDefaults, options);
        };
      }
    };
  }
};
