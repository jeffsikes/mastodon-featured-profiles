/* global Vue */ // for eslint
/* global Mastodon */ // for eslint

var app = Vue.createApp({
  el: "#app",
  data() {
    return {
      server: "",
      servers: [],
      read_only: false,
      mastodon: undefined,
      my_account: [],
      my_endorsements: [],
      my_followed: [],
      user_id: undefined,
      loading_followed: true,
      loading_endorsements: true,
      total_followed_loaded: 0,
      total_endorsements_loaded: 0,
      max_retrieval_count: 80,
      max_displayed_endorsements: 27,
      refresh_interval: 120, // minutes
      followed_threshold: 550,
      followed_search: "",
      debug_enabled: false,
      public_root_url: "https://featured-profiles.box464.com/"
    };
  },

  computed: {
    computedAuthorizedScope() {
      this.logger("read only value", this.userPreferences.read_only);
      if (
        this.userPreferences &&
        this.userPreferences.read_only != null &&
        this.userPreferences.read_only == false
      ) {
        return "read:accounts write:accounts read:follows";
      } else {
        return "read:accounts read:follows";
      }
    },
    userPreferences() {
      if (localStorage.userPreferences) {
        return JSON.parse(localStorage.userPreferences);
      } else {
        localStorage.userPreferences = JSON.stringify({
          read_only: this.read_only,
          server: "",
          last_refresh: new Date(),
        });
        return localStorage.userPreferences;
      }
    },
  },

  async created() {
    this.mastodon = await Mastodon.initialize({
      app_name: "Featured Profiles Lab",
      app_url: this.public_root_url,
      // best docs for scopes is here: https://github.com/mastodon/mastodon/pull/7929

      scopes: this.userPreferences.read_only
        ? "read:accounts read:follows"
        : "read:accounts write:accounts read:follows",
    });

    if (!this.mastodon.loggedIn()) {
      this.logger("not logged in");
      if (localStorage.mastodon_servers != null) {
        this.servers = JSON.parse(localStorage.mastodon_servers);
      } else {
        this.servers = await this.get_servers();
      }
      return;
    } else {
      this.user_id = await this.get_user_id();

      // If userPreferences.last_refresh is more than 1 hour ago, refresh the data.
      if (this.userPreferences && this.userPreferences.last_refresh != null) {
        var forceRefresh = false;
        const lastRefresh = new Date(this.userPreferences.last_refresh);
        const now = new Date();
        const diff = now - lastRefresh;
        const minutes = Math.floor(diff / 1000 / 60);
        if (minutes > this.refresh_interval) {
          forceRefresh = true;
        }
      }

      this.refresh(this.user_id, forceRefresh);

      this.showModal();
    }
  },

  watch: {
    read_only(newValue) {
      if (localStorage.userPreferences) {
        var userPreferences = JSON.parse(localStorage.userPreferences);
        userPreferences.read_only = newValue;
        localStorage.userPreferences = JSON.stringify(userPreferences);
      }
    },
  },

  methods: {
    async refresh(userId, forceRefresh = false) {
      this.logger("refresh", userId);
      this.loading_followed = true;
      this.loading_endorsements = true;

      this.my_account = await this.get_account(userId);

      const [followed, account, endorsements] = await Promise.all([
        this.get_followed(
          userId,
          forceRefresh,
          this.userPreferences.read_only
        ).then((data) => {
          this.loading_followed = false;
          return data;
        }),
        this.get_account(userId, forceRefresh),
        this.get_account_endorsements(forceRefresh).then((data) => {
          this.loading_endorsements = false;
          return data;
        }),
      ]);

      this.my_account = account;
      this.my_endorsements = endorsements;

      // Remove the accounts that are already endorsed
      endorsements.forEach((item, index) => {
        const foundItem = followed.find(
          (item) => item.acct == endorsements[index].acct
        );
        if (foundItem) {
          followed.splice(followed.indexOf(foundItem), 1);
        }
      });

      this.my_followed = followed;

      // Set last refresh date.
      localStorage.userPreferences = JSON.stringify({
        read_only:
          this.userPreferences.read_only == null
            ? false
            : this.userPreferences.read_only,
        server: this.userPreferences.server,
        last_refresh: new Date(),
      });

      this.logger("my_account", this.my_account);
      this.logger("my_endorsements", this.my_endorsements);
      this.logger("my_followed", this.my_followed);
    },
    logout() {
      this.mastodon.logout();
      localStorage.clear();
      sessionStorage.clear();
      window.location.hash = "";
      window.location.reload();
    },

    showModal() {
      if (sessionStorage.modalViewed != "true" && this.userPreferences.read_only == true) {
        var modal = document.getElementById("readOnlyModal");
        modal.setAttribute("class", "modal-is-opening")
        modal.setAttribute("open", "");
        sessionStorage.modalViewed = true;
      }
    },

    hideModal() {
      var modal = document.getElementById("readOnlyModal");
      modal.setAttribute("class", "modal-is-closing")
      modal.removeAttribute("open");
    },

    async set_spinner(toggle) {
      const progressBar = document.getElementById("progress-bar");

      const statusAttribute = progressBar.getAttribute("aria-busy");

      if (progressBar && statusAttribute != toggle) {
        progressBar.setAttribute("aria-busy", toggle);
        progressBar.style.display = toggle ? "block" : "none";

        this.current_progress_bar_visibility = toggle;
      }
    },

    async logger(item1, item2) {
      if (this.debug_enabled && this.debug_enabled == true) {
        if (item2 != null) {
          console.log(item1, item2);
        } else {
          console.log(item1);
        }
      }

    },

    async get_servers() {
      const response = await this.mastodon.get_servers();
      if (!response.ok) {
        alert("error getting servers");
      }
      const data = await response.json();
      this.logger("servers: ", data.data);
      return data.data;
    },

    async get_user_id() {
      if (this.user_id && this.user_id.length > 0) {
        return this.user_id;
      } else {
        const response = await this.mastodon.get(
          "/api/v1/accounts/verify_credentials"
        );
        if (!response.ok) {
          alert("error getting user id");
        }
        const data = await response.json();
        return data.id;
      }
    },

    async get_account(userId, forceRefresh = false) {
      if (
        forceRefresh == false &&
        localStorage.my_account &&
        localStorage.my_account.length > 0
      ) {
        return JSON.parse(localStorage.my_account);
      } else {
        const response = await this.mastodon.get(`/api/v1/accounts/${userId}`);
        if (!response.ok) {
          alert("error getting user account");
        }
        const data = await response.json();

        localStorage.my_account = JSON.stringify(data);
        this.logger("account data: ", data);
        return data;
      }
    },

    async get_account_endorsements(forceRefresh = false) {
      this.loading_endorsements = true;

      if (
        forceRefresh == false &&
        localStorage.my_endorsements &&
        localStorage.my_endorsements.length > 0
      ) {
        data = JSON.parse(localStorage.my_endorsements);
      } else {
        const response = await this.mastodon.get(
          `/api/v1/endorsements?limit=${this.max_retrieval_count}`
        );
        var data = [];
        if (!response.ok) {
          alert("error getting account endorsements");
        } else {
          data = await response.json();

          if (this.parse_link_header(response.headers.get("link"))) {
            let next = this.parse_link_header(response.headers.get("link"));
            while (next) {
              const response = await this.mastodon.get(next);
              const newData = await response.json();
              data.push(...newData);
              next = this.parse_link_header(response.headers.get("link"));
              this.total_endorsements_loaded = data.length;
            }
          }
        }
      }

      this.logger("get account endorsements: ", data);

      this.loading_endorsements = false;

      this.total_endorsements_loaded = data.length;

      this.my_endorsements = data;

      localStorage.my_endorsements = JSON.stringify(data);

      return data;
    },

    async get_followed(userId, forceRefresh = false, readOnly = true) {
      var data = [];

      if (
        this.$root.my_account.following_count <= this.$root.followed_threshold
      ) {
        this.$root.my_followed = [];
      }

      // If userId follows more than..1,000 people? Then we need to skip this and just use the search function.
      if (
        this.$root.my_account.following_count <=
          this.$root.followed_threshold &&
        this.$root.my_account.following_count > 0
      ) {
        this.logger("Reached 01");
        if (readOnly == false || readOnly == true) {
          this.logger("Reached 02");
          if (
            forceRefresh == false &&
            localStorage.my_followed &&
            localStorage.my_followed.length > 0
          ) {
            this.logger("Reached 03");
            data = JSON.parse(localStorage.my_followed);
          } else {
            this.logger("Reached 04");
            this.$root.loading_followed = true;

            const response = await this.mastodon.get(
              `/api/v1/accounts/${userId}/following?limit=${this.max_retrieval_count}`
            );

            if (!response.ok) {
              alert("error getting followed accounts");
            } else {
              data = await response.json();

              this.$root.total_followed_loaded = data.length;

              if (this.parse_link_header(response.headers.get("link"))) {
                let next = this.parse_link_header(response.headers.get("link"));
                while (next) {
                  const response = await this.mastodon.get(next);
                  const newData = await response.json();
                  data.push(...newData);
                  next = this.parse_link_header(response.headers.get("link"));
                  this.$root.total_followed_loaded = data.length;

                  this.logger("currentLength", data.length);
                  this.logger("next", next);
                }
              }

              this.$root.total_followed_loaded = data.length;
            }
          }
        }

        const partialData = data.map(
          ({ id, acct, display_name, avatar, bot, group, memorial, url, header, emojis }) => ({
            id,
            acct,
            display_name,
            avatar,
            bot,
            group,
            memorial,
            url,
            header,
            emojis,
          })
        );

        data = partialData;
      }

      this.$root.loading_followed = false;
      this.$root.total_followed_loaded = data.length;
      localStorage.my_followed = JSON.stringify(data);

      return data;
    },

    async search_accounts(searchTerm, followedOnly = false, limit = 80) {
      // Using /v1/accounts/search
      // https://docs.joinmastodon.org/methods/accounts/#search

      var data = [];

      if (searchTerm && searchTerm.length > 0) {
        const response = await this.mastodon.get(
          `/api/v1/accounts/search?q=${searchTerm}&following=${followedOnly}&limit=${limit}`
        );

        if (!response.ok) {
          alert("error searching accounts");
        } else {
          const data = await response.json();
          let currentOffset = data.length;
          let currentDataLength = data.length;

          while (currentDataLength == 80) {
            const response = await this.mastodon.get(
              `/api/v1/accounts/search?q=${searchTerm}&following=${followedOnly}&limit=80&offset=${currentOffset}`
            );

            const newData = await response.json();
            data.push(...newData);

            currentOffset = currentOffset + newData.length;

            currentDataLength = newData.length;

            this.logger("currentLength", currentDataLength);
            this.logger("currentOffset", currentOffset);
          }

          return data;
        }
      }

      return null;
    },

    async search(
      searchValue,
      type = "accounts",
      accountId = 0,
      followedOnly = true,
      limit = 40
    ) {
      // Using /v2/search
      // https://docs.joinmastodon.org/methods/search/#v2
      // Limited to 40 results, but can be paginated
      // Type Options = accounts, hashtags, statuses
      // New filter options: https://docs.vmst.io/infrastructure/search#search-modifiers
      this.logger("search_followed", searchValue);
      this.followed_search = searchValue;

      var data = [];
      var next = this.max_retrieval_count++;

      var response = await this.mastodon.get(
        `/api/v2/search?q=${searchValue}&type=${type}&following=${followedOnly}&limit=${this.max_retrieval_count}`
      );
      data = await response.json();

      if (!response.ok) {
        alert("error searching followed accounts");
      } else {
        if (data.accounts.length == this.max_retrieval_count) {
          next = next++;
          while (newData.accounts.length == this.max_retrieval_count) {
            next = next++;
            const response = await this.mastodon.get(
              `/api/v2/search?q=${searchValue}&type=account&limit=${this.max_retrieval_count}&offset=${next}`
            );
            const newData = await response.json();
            if (newData.accounts.length == 0) {
              break;
            } else {
              data.push(...newData);
              this.logger("currentLength", data.length);
              this.logger("next", next++);
            }
          }
        }
      }

      return data;
    },

    async set_account_endorsement(userId) {
      const response = await this.mastodon.post(
        `/api/v1/accounts/${userId}/pin`
      );
      if (!response.ok) {
        alert("error setting account endorsement");
      } else {
        const data = await response.json();
        return data;
      }

      return null;
    },

    async remove_account_endorsement(userId) {
      const response = await this.mastodon.post(
        `/api/v1/accounts/${userId}:/unpin`
      );
      if (!response.ok) {
        alert("error removing account endorsement");
      } else {
        const data = await response.json();
        return data;
      }

      return null;
    },

    parse_emojis(text, emojis = []) {
      if (!text) return "";
      if (!emojis.length) return text;
      if (text.indexOf(":") === -1) return text;
      // Replace shortcodes in text with emoji
      // emojis = [{ shortcode: 'smile', url: 'https://example.com/emoji.png' }]
      emojis.forEach((emoji) => {
        const { shortcode, staticUrl, url } = emoji;
        text = text.replace(
          new RegExp(`:${shortcode}:`, "g"),
          `<img style="margin-left:5px;" class="shortcode-emoji emoji" src="${url}" alt=":${shortcode}:" width="16" height="16" loading="lazy" decoding="async" />`
        );
      });
      // console.log(text, emojis);
      return text;
    },

    parse_link_header(link) {
      if (!link) {
        return null;
      }
      const links = link.split(",");
      const next = links.find((link) => link.includes('rel="next"'));
      if (!next) {
        return null;
      }
      const url = next.match(/<(.*)>/)[1];
      return url;
    },

    sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    },

    login: async function () {
      let server = this.server;
      if (server == "") {
        alert("Please enter a server address");
        return;
      }

      // if server is not a mastodon instance alert the user
      // call out to the server to see if it is a mastodon instance
      server = server.replace("http://", "");
      server = server.replace("https://", "");

      try {
        const response = await fetch("https://" + server + "/api/v1/instance");
        if (!response.ok) {
          alert(
            "The server address you entered returned an unexpected response. Please check the address and try again."
          );
          return;
        }

        this.logger(this.computedAuthorizedScope);

        if (this.userPreferences.read_only == true) {
          this.mastodon = await Mastodon.initialize({
            app_name: "Featured Profiles Lab",
            app_url: this.public_root_url,
            // best docs for scopes is here: https://github.com/mastodon/mastodon/pull/7929
            scopes: "read:accounts read:follows",
          });
        }

        localStorage.userPreferences = JSON.stringify({
          read_only: this.userPreferences.read_only,
          server: server,
          last_refresh: new Date(),
        });

        //this.options.scopes = this.computedAuthorizedScope;

        await this.mastodon.login("https://" + server);
      } catch (error) {
        alert(
          "The server address you entered returned an error. Please check the address and try again."
        );
      }
    },
  },
});

app.component("account", {
  props: ["profile", "endorsements", "followed", "loading_followed"],
  template: "#account-template",
}),
  app.component("endorsements", {
    template: "#endorsements-template",
    props: {
      endorsements: {
        type: Array,
        required: true,
      },
      total_endorsements_loaded: {
        type: Number,
        required: true,
      },
      loading_endorsements: {
        type: Boolean,
        required: true,
      },
      global_refresh: {
        type: Boolean,
        required: true,
      },
    },
    data() {
      return {
        searchValue: "",
      };
    },
    computed: {
      filteredEndorsements() {
        let tempEndorsements = [];

        if (this.searchValue && this.searchValue.length >= 1) {
          tempEndorsements = this.endorsements.filter((item) => {
            return (
              item.display_name
                .toLowerCase()
                .includes(this.searchValue.toLowerCase()) ||
              item.acct.toLowerCase().includes(this.searchValue.toLowerCase())
            );
          });
        } else {
          tempEndorsements = this.endorsements.slice(
            0,
            this.endorsements.length > this.$root.max_displayed_endorsements
              ? this.$root.max_displayed_endorsements
              : this.endorsements.length
          );
        }

        this.$root.logger("tempEndorsements", tempEndorsements);

        return tempEndorsements;
      },
      followedCount() {
        this;
      },
    },
    watch: {
      total_endorsements_loaded(newCount) {
        return newCount;
      },
      endorsements(newEndorsements) {
        return newEndorsements;
      },
    },
    methods: {
      unpin(id) {
        const index = this.endorsements.findIndex((item) => item.id === id);

        this.$root
          .remove_account_endorsement(this.endorsements[index].id)
          .then((response) => {
            if (response !== null) {
              // add the item to the followed list
              if (
                this.$root.my_followed.findIndex((item) => item.id === id) == -1
              ) {
                this.$root.my_followed.unshift(this.endorsements[index]);
              }
              // remove the indexed item from this.endorsements
              //                    this.$root.my_endorsements.splice(index, 1);
              this.endorsements.splice(index, 1);
              localStorage.my_endorsements = JSON.stringify(this.endorsements);
            }
          });
      },
    },
  }),
  app.component("followed", {
    template: "#followed-template",
    data() {
      return {
        searchValue: "",
      };
    },
    props: {
      followed: {
        type: Array,
        required: true,
      },
      total_followed_loaded: {
        type: Number,
        required: true,
      },
      loading_followed: {
        type: Boolean,
        required: true,
      },
      global_refresh: {
        type: Boolean,
        required: true,
      },
    },
    watch: {
      total_followed_loaded(newCount) {
        return newCount;
      },
      followed(newFollowed) {
        return newFollowed;
      },
    },
    computed: {
      filteredFollowed() {
        let tempFollowed = [];

        if (this.searchValue && this.searchValue.length >= 1) {
          tempFollowed = this.followed.filter((item) => {
            return (
              item.display_name
                .toLowerCase()
                .includes(this.searchValue.toLowerCase()) ||
              item.acct.toLowerCase().includes(this.searchValue.toLowerCase())
            );
          });
        }

        this.$root.logger("tempFollowed", tempFollowed);

        return tempFollowed;
      },
    },
    methods: {
      getFollowedAccounts() {
        let tempFollowed = [];

        if (this.searchValue && this.searchValue.length >= 2) {
          this.$root
            .search_accounts(this.searchValue, true)
            .then((finalResult) => {
              finalResult.forEach((item) => {
                if (item.id != this.$root.my_account.id) {
                  let accountEndorsed = this.$root.my_endorsements.some(
                    (el) => el.id === item.id
                  );
                  if (!accountEndorsed) {
                    tempFollowed.push(item);
                  }
                }
              });

              this.$root.logger("tempFollowedMapped", tempFollowed);

              this.$root.my_followed = tempFollowed;

              this.$root.logger("temp1", this.filteredFollowed);
            });
        } else {
          this.$root.logger("tempManualFollowed", this.filteredFollowed);
          this.filteredFollowed = this.filteredFollowed;

          this.followed = this.filteredFollowed;

          this.$root.logger("temp2", this.filteredFollowed);
        }
      },
      pin(id) {
        const index = this.followed.findIndex((item) => item.id === id);
        // add the item to the followed list
        this.$root
          .set_account_endorsement(this.followed[index].id)
          .then((response) => {
            if (response !== null) {
              // Add the item to the top of the endorsements list
              this.$root.my_endorsements.unshift(this.followed[index]);
              localStorage.my_endorsements = JSON.stringify(
                this.$root.my_endorsements
              );
              // remove the indexed item from this.followed
              this.followed.splice(index, 1);
              localStorage.my_followed = JSON.stringify(this.followed);
            }
          });
      },
    },
  }),
  app.mount("#app");
