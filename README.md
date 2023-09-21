# Mastodon Featured Profiles

Manage your featured profile selections in a centralized location.

## What is it?

Currently, this is a half-dead feature of Mastodon. Profiles can be marked as featured, but there's no way to view them. In their previous existence, a random set of your selections would appear on your public facing profile page for others to view, similar to how featured hashtags currently behave.

### No Server 

This is a static site: there's no server, all your data is stored only in your
browser, as soon as you clear your cache it's all gone.

I've tested it with my personal mastodon server, it may or may not work with other Mastodon instances.

### This is tinkering code

I wanted to learn about Mastodon - how to authenticate, how to pull data down, how to display it in a format that makes sense.

It's not production ready. This is just a local development toy.

You can use it however you want.

### How to start

To start this locally, run:

```
python3 -m http.server 8081
```

Then open http://localhost:8081 in your browser.

### Tiny Mastodon Library
The site contains a tiny Mastodon library called `mastodon.js` for logging in with
OAuth and making requests. You can see some examples of how to use it in `script.js`.

This code relies heavily on the work of [Julia Evans](https://mastodon.social/@b0rk), who [created this miniscule Mastodon Library](https://github.com/jvns/mastodon-threaded-replies#contains-a-tiny-mastodon-library) that authenticates requests and makes a few calls.

I built on this base and added more calls to retrieve various timelines, hashtags, lists, etc.

### Maintenance
Right now this is just a hobby. I don't know if I will continue to fiddle with it. 

You are welcome to download, clone or fork this and make it your own. I'd love to hear what you're doing with it!

### PicoCss

[PicoCss Version 2](https://v2.picocss.com/docs/v2) was used to fancy up this site. I love this tiny framework. It really gets out of your way to let you learn something new, while ensuring you have something that looks nice.

It may be possible to use the classless version of PicoCss, but found that with the Vue SPA there were some difficulties with centering the body using the classless version.

To make your own theme, Pico suggests updating and recompiling the SASS file, which I did not want to do because that adds additional complexities to the application.

Instead, I fell back to CSS variables, which are also offered as a suggestion and work well in this scenario.

Here's the list of variables.

* https://v2.picocss.com/docs/css-variables


[Featured Profile Open Issue 9646](https://github.com/mastodon/mastodon/issues/9646#issuecomment-450443181)

![From 2018, showing featured / endorsed profiles in the public sidebar where hashtags also displayed](https://user-images.githubusercontent.com/10606431/50530745-4d686380-0ac6-11e9-8f75-7f26098ffa2b.png)

It was noted that the UI only allows up to 5 endorsements, but the API is allowing me to go alot further than that!

[Title](https://github.com/mastodon/mastodon/issues/8162)

There's even discussion of "endorsed content", too! Oh - this is at the admin level tho, not end users.

[Endorsed Content Idea - everything is endorsed!](https://github.com/mastodon/mastodon/issues/13284)