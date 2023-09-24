# Mastodon Featured Profiles

A streamlined tool for easier management of your featured profiles. [Use it now](https://featured-profiles.box464.com), or [learn more about it](https://box464.com/featured-profiles) first.

## What is it?

Mastodon's featured profiles is a way to highlight your most beloved followed accounts, but was partially removed in a previous upgrade.

Currently, this is a zombie feature. Profiles can be marked as featured through the web interface, but there's no way for others to view them. In their previous existence, a random set of your selections would appear on your public facing profile page for others to view, similar to how featured hashtags currently behave.

This application provides a way to view and manage your featured profiles in preparation for a possible revival (see roadmap item [MAS-13](https://joinmastodon.org/roadmap)).

## How to build

To start this locally, run:

```
python3 -m http.server 8081
```

Then open http://localhost:8081 in your browser.

## This is tinkering code

I have a lot to learn. Vue, Mastodon, and Open source are all new concepts to me. This provided a unique opportunity to get fairly detailed into an area of Mastodon that hasn't been explored much. 

You can use it however you want.

## This code is unmaintained 
I really take Julia Evan's [code maintenance guidelines](https://github.com/jvns/mastodon-threaded-replies#this-code-is-unmaintained) to heart.

When I saw these declaratives, I was initially taken aback by the tone, but I now fully admire the upfront honesty.

* I made this for me, to learn new things.
* I know the code isn't perfect.
* If you find a bug, please let me know! But don't expect them to be fixed quickly...or at all.
* I'm not planning to take feature requests, but share your ideas anyway, who knows?!
* It's open source under an MIT license - take it and do what you will.

## Third Party Resources

### Vue.js
The site is built using [Vue.js](https://vuejs.org/).

### Tiny Mastodon Library
The site contains a tiny Mastodon library called `mastodon.js` for logging in with
OAuth and making requests. You can see some examples of how to use it in `script.js`.

This code relies heavily on the work of [Julia Evans](https://mastodon.social/@b0rk), who [created this miniscule Mastodon Library](https://github.com/jvns/mastodon-threaded-replies#contains-a-tiny-mastodon-library) that authenticates requests and makes a few calls.

I built on this base and added more calls to retrieve various timelines, hashtags, lists, etc. which is now used in my [Mastodon Starter Kit](https://mastodon-starter-vue.netlify.app/), another thing I'm tinkering with. Portions of that code were pulled into this application.

### PicoCss

[PicoCss Version 2](https://v2.picocss.com/docs/v2) was used to fancy up this site. I love this tiny framework. It really gets out of your way to let you learn something new, while ensuring you have something that looks nice.

It may be possible to use the classless version of PicoCss, but found that with the Vue SPA there were some difficulties with centering the body using the classless version.

To make your own theme, Pico suggests updating and recompiling the SASS file, which I did not want to do because that adds additional complexities to the application.

Instead, I fell back to CSS variables, which are also offered as a suggestion and work well in this scenario.

Here's the list of [CSS variables](https://v2.picocss.com/docs/css-variables).

