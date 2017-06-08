/**
 * Copyright 2017 The AMP HTML Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {CSS} from '../../../build/amp-facebook-object-comments-0.1.css';
import {isLayoutSizeDefined} from '../../../src/layout';
import {assertHttpsUrl, parseQueryString} from '../../../src/url';

export class AmpFacebookObjectComments extends AMP.BaseElement {
  /** @param {!AmpElement} element */
  constructor(element) {
    super(element);

    /**
     * The encoded ID of the object to display comments for.
     * @private @const {string}
     */
    this.encodedObjectId_ = null;

    /** @private {!Element} */
    this.container_ = this.win.document.createElement('div');

    /** @private {!Element} */
    this.loginButton_ = this.win.document.createElement('button');
  }

  /** @override */
  buildCallback() {
    this.encodedObjectId_ = this.win.encodeURIComponent(
        assertHttpsUrl(this.element.getAttribute('object-id'), this.element));

    this.loginButton_.textContent = 'Login to view comments';
    this.container_.classList.add('container');
    this.element.appendChild(this.container_);
  }

  /** @override */
  isLayoutSupported(layout) {
    return isLayoutSizeDefined(layout);
  }

  /** @override */
  layoutCallback() {
    const hashParams = parseQueryString(this.win.location.hash.substring(1));

    if (hashParams['access_token']) {
      this.stripHashParamsFromUrl_();
      this.persistGrantedAccess_(hashParams['access_token']);
    }

    if (this.isAccessGranted_()) {
      this.refreshComments_(`${this.encodedObjectId_}/comments?filter=stream`);
    } else {
      this.loginButton_.addEventListener('click', (e) => this.signIn_());
      this.container_.appendChild(this.loginButton_);
    }

    this.applyFillContent(this.container_);
    return this.loadPromise(this.container_);
  }

  stripHashParamsFromUrl_() {
    const location = this.win.location;
    this.win.history.replaceState(
        '', this.win.document.title, location.pathname + location.search);
  }

  /** @param {!string} accessToken */
  persistGrantedAccess_(accessToken) {
    this.win.localStorage.setItem('oauth2-fb', accessToken);
  }

  /** @return {boolean} */
  isAccessGranted_() {
    return this.win.localStorage.getItem('oauth2-fb') != null;
  }

  refreshComments_(url) {
    this.callApi_(url)
        .then((body) => {
          this.clearContainer_();

          for (const comment of body['data']) {
            const message = this.win.document.createElement('div');
            message.classList.add('message');
            message.textContent = comment['message'];

            const name = this.win.document.createElement('div');
            name.textContent = comment['from']['name'];
            name.classList.add('name');

            const createdTime = this.win.document.createElement('div');
            createdTime.textContent =
                new Date(comment['created_time']).toLocaleString();
            createdTime.classList.add('created-time');

            const commentContainer = this.win.document.createElement('div');
            commentContainer.classList.add('comment-container');
            commentContainer.appendChild(message);
            commentContainer.appendChild(name);
            commentContainer.appendChild(createdTime);

            this.container_.appendChild(commentContainer);
          }

          this.addLinkIfNecessary_(body['paging']['previous'], 'Previous');
          this.addLinkIfNecessary_(body['paging']['next'], 'Next');
          this.win.scrollTo(0, 0);
        })
        .catch((error) => console.log(error));
  }

  clearContainer_() {
    this.container_.innerHTML = '';
  }

  addLinkIfNecessary_(url, text) {
    if (!url) {
      return;
    }

    const link = this.win.document.createElement('a');
    link.href = 'javascript:void(0)';
    link.textContent = text;
    link.addEventListener('click', (e) => this.refreshComments_(url));
    this.container_.appendChild(link);
  }

  /**
   * @param {!string} url The URL of the API to call. If it is not absolute
   *     (i.e., there's no double slashes `//`), then it is assumed that the URL
   *     is relative to `https://graph.facebook.com/vX.X/`.
   * @param {!string=} method The HTTP method to use for the call.
   * @return {!Promise<object>} The JSON object contained in the response.
   */
  callApi_(url, method = 'GET') {
    if (!(/\/\//.test(url))) {
      url = 'https://graph.facebook.com/v2.9/' + url;
    }
    const accessToken = this.win.localStorage.getItem('oauth2-fb');
    return this.win
        .fetch(url, {
          method: method,
          headers: new Headers({Authorization: `Bearer ${accessToken}`}),
        })
        .then((response) => response.json())
        .then((body) => {
          if (body['error']) {
            const error = body['error'];
            if (error['type'] == 'OAuthException' && error['code'] == 190) {
              this.signIn_();
            }
            throw new Error(error['message']);
          }
          return body;
        });
  }

  /** Redirects to the OAuth2 implicit flow sign in dialog. */
  signIn_() {
    const form = this.win.document.createElement('form');
    form.setAttribute('method', 'GET');
    form.setAttribute('action', 'https://www.facebook.com/v2.9/dialog/oauth');

    const params = {
      'client_id': '733349513518212',
      'redirect_uri': this.win.location.href,
      //'scope': 'publish_actions,user_likes',
      'response_type': 'token'
    };
    for (const p in params) {
      const input = this.win.document.createElement('input');
      input.setAttribute('type', 'hidden');
      input.setAttribute('name', p);
      input.setAttribute('value', params[p]);
      form.appendChild(input);
    }

    this.win.document.body.appendChild(form);
    form.submit();
  }
}

AMP.registerElement(
    'amp-facebook-object-comments', AmpFacebookObjectComments, CSS);
