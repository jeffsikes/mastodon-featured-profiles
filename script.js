/* global Vue */ // for eslint
/* global Mastodon */ // for eslint

var app = Vue.createApp({
    el: '#app',
    data() {
        return {
            server: "",
            servers: [],
            mastodon: undefined,
            read_only: false,
            my_account: [],
            my_endorsements: [],
            my_followed: [],
            user_id: undefined,
            loading_followed: true,
            loading_endorsements: true,
            total_followed_loaded: 0,
            total_endorsements_loaded: 0,
            followed_search: "",
        }
    },

    computed: {
        computedAuthorizedScope() {
            console.log("read only value", this.read_only);
            return this.read_only ? "read:accounts read:follows" : "read:accounts write:accounts read:follows";
        }
    },

    async mounted() {
        this.mastodon = await Mastodon.initialize({
            app_name: 'Featured Profiles Lab (Read+Write)',
            app_url: 'https://featured-profiles.netlify.app/',
            // best docs for scopes is here: https://github.com/mastodon/mastodon/pull/7929

            scopes: (this.userPreferences.read_only ? 'read:accounts read:follows': 'read:accounts write:accounts read:follows'),
        });

        if (!this.mastodon.loggedIn()) {
            console.log('not logged in');
            if (localStorage.mastodon_servers != null) {
                this.servers = JSON.parse(localStorage.mastodon_servers);
            }
            else {
                this.servers = await this.get_servers();
            }
            return;
        }
        else {
            this.loading_followed = true;
            this.loading_endorsements = true;

            this.user_id = await this.get_user_id();
    
            this.my_account = await this.get_account(this.user_id);
    
            const [followed, account, endorsements1] = await Promise.all([this.get_followed(this.user_id), this.get_account(this.user_id),this.get_account_endorsements()]);
    
            this.my_account = account;
            this.my_endorsements = endorsements1;
            this.my_followed = followed;
    
            this.loading_endorsements = false;

            const endorsements = this.my_endorsements;
            const endorsements_ids = endorsements.map(item => item.id);
    
            this.my_followed.forEach((item, index) => {
                if (endorsements_ids.includes(item.id)) {
                    this.my_followed.splice(index, 1);
                }
            });        
    
            console.log('my_account', this.my_account);
            console.log('my_endorsements', this.my_endorsements);
            console.log('my_followed', this.my_followed);
    
            this.loading_followed = false;
    
        }

    },
    computed: {
        userPreferences() {
            if (localStorage.userPreferences) {
                return JSON.parse(localStorage.userPreferences);
            }
            else {
                return {read_only: false, server: ""};
            }
        }
    },

    watch: {
        name(newFollowed) {
            localStorage.my_followed = newFollowed;
        },
        read_only(newValue) {
            localStorage.userPreferences = JSON.stringify({read_only: newValue, server: this.server});
        }
    },

    methods: {
        logout() {
            this.mastodon.logout();
            localStorage.clear();
            window.location.hash = "";
            window.location.reload();
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

        async get_servers() {
            const response = await this.mastodon.get_servers();
            if (!response.ok) {
                alert('error getting servers');
            }
            const data = await response.json();
            console.log('servers: ', data.data);
            return data.data;
        },

        async get_user_id() {
            if (this.user_id &&  this.user_id.length > 0) {
                return this.user_id;
            }
            else {
                const response = await this.mastodon.get('/api/v1/accounts/verify_credentials');
                if (!response.ok) {
                    alert('error getting user id');
                }
                const data = await response.json();
                return data.id;
            }
        },

        async get_account(userId) {
            if (localStorage.my_account && localStorage.my_account.length > 0) {
                return JSON.parse(localStorage.my_account);
            }
            else {
                const response = await this.mastodon.get(`/api/v1/accounts/${userId}`);
                if (!response.ok) {
                    alert('error getting user account');
                }
                const data = await response.json();

                localStorage.my_account = JSON.stringify(data);
                console.log('account data: ', data);
                return data;
            }
        },

        async get_account_endorsements(forceRefresh = false) {
            this.loading_endorsements = true;

            if (forceRefresh == false && localStorage.my_endorsements && localStorage.my_endorsements.length > 0) {
                data = JSON.parse(localStorage.my_endorsements);
            }
            else {
                this.$root.loading_endorsements = true;

                const response = await this.mastodon.get('/api/v1/endorsements?limit=4');
                var data = [];
                if (!response.ok) {
                    alert('error getting account endorsements');
                }
                else {
                    data = await response.json();
    
                    if (this.parse_link_header(response.headers.get('link'))) {
                        let next = this.parse_link_header(response.headers.get('link'));
                        while (next) {
                            const response = await this.mastodon.get(next);
                            const newData = await response.json();
                            data.push(...newData);
                            next = this.parse_link_header(response.headers.get('link'));
                            this.$root.total_endorsements_loaded = data.length;
                        }
                    }
                }
            }


            console.log('get account endorsements: ', data);

            this.$root.loading_endorsements = false;
            this.loading_endorsements = false;

            this.$root.total_endorsements_loaded = data.length;

            this.$root.my_endorsements = data;
            
            localStorage.my_endorsements = JSON.stringify(data);

            return data;

        },

        async get_followers(userId, forceRefresh = false) {
            if (forceRefresh == false && localStorage.my_followers && localStorage.my_followers.length > 0) {
                data = localStorage.my_followers;
            }
            else {
                const response = await this.mastodon.get(`/api/v1/accounts/${userId}/followers`);
                if (!response.ok) {
                    alert('error getting account following');
                }
                const data = await response.json();
            }

            return data;
        },

        async get_followed(userId, forceRefresh = false) {

            if (forceRefresh == false && localStorage.my_followed && localStorage.my_followed.length > 0) {
                data = JSON.parse(localStorage.my_followed);
            }
            else {
                this.$root.loading_followed = true;

                const response = await this.mastodon.get(`/api/v1/accounts/${userId}/following?limit=80`);
                var data = [];
                if (!response.ok) {
                    alert('error getting followed accounts');
                }
                else {
                    data = await response.json();
    
                    this.$root.total_followed_loaded = data.length;

                    if (this.parse_link_header(response.headers.get('link'))) {
                        let next = this.parse_link_header(response.headers.get('link'));
                        while (next) {
                            const response = await this.mastodon.get(next);
                            const newData = await response.json();
                            data.push(...newData);
                            next = this.parse_link_header(response.headers.get('link'));
                            this.$root.total_followed_loaded = data.length;
                            console.log('next', next);
                        }
                    }
    
                    // Remove the accounts that are already endorsed
                    var endorsements = await this.get_account_endorsements();
                    if (endorsements && endorsements.length == 0) {
                        endorsements = await this.get_account_endorsements();
                    }
                    const endorsements_ids = endorsements.map(item => item.id);
                    data.forEach((item, index) => {
                        if (endorsements_ids.includes(item.id)) {
                            data.splice(index, 1);
                        }
                    });
    
                }
            }

            this.$root.loading_followed = false;
            this.$root.total_followed_loaded = data.length;
            localStorage.my_followed = JSON.stringify(data);

            return data;
        },

        async set_account_endorsement(userId) {
            const response = await this.mastodon.post(`/api/v1/accounts/${userId}/pin`);
            if (!response.ok) {
                alert('error setting account endorsement');
            }
            else {
                const data = await response.json();
                return data;
            }

            return null;
        },

        async remove_account_endorsement(userId) {
            const response = await this.mastodon.post(`/api/v1/accounts/${userId}:/unpin`);
            if (!response.ok) {
                alert('error removing account endorsement');
            }
            else {
                const data = await response.json();
                return data;
            }

            return null;
        },

        parse_link_header(link) {
            if (!link) {
                return null;
            }
            const links = link.split(',');
            const next = links.find(link => link.includes('rel="next"'));
            if (!next) {
                return null;
            }
            const url = next.match(/<(.*)>/)[1];
            return url;
        },

        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        },

        login: async function() {
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
                    alert("The server address you entered returned an unexpected response. Please check the address and try again.");
                    return;
                }

                console.log(this.computedAuthorizedScope);

                if (this.read_only) {
                    this.mastodon = await Mastodon.initialize({
                        app_name: 'Featured Profiles Lab (Read+Write)',
                        app_url: 'https://featured-profiles.netlify.app/',
                        // best docs for scopes is here: https://github.com/mastodon/mastodon/pull/7929
                        scopes: 'read:accounts read:follows',
                    });
            
                }

                localStorage.userPreferences = JSON.stringify({read_only: this.read_only, server: server});
                
                //this.options.scopes = this.computedAuthorizedScope;

                await this.mastodon.login("https://" + server);
            }
            catch (error) {
                alert("The server address you entered returned an error. Please check the address and try again.")
            }


        },


    }
})


app.component('account', {
    props: ['profile', 'endorsements', 'followed', 'loading_followed'],
    template: '#account-template',
}),

app.component('endorsements', {
    template: '#endorsements-template',
    props: {
        endorsements: {
            type: Array,
            required: true
        },
        total_endorsements_loaded: {
            type: Number,
            required: true
        },
        loading_endorsements: {
            type: Boolean,
            required: true
        },
    },
    data() {
        return {
            searchValue: ''
        }
    },
    computed: {
        filteredEndorsements() {
            let tempEndorsements = [];

            if (this.searchValue && this.searchValue.length >= 1) {
                tempEndorsements = this.$root.my_endorsements.filter((item) => {
                    return item.display_name.toLowerCase().includes(this.searchValue.toLowerCase()) || item.acct.toLowerCase().includes(this.searchValue.toLowerCase());
                });
            }
            else {
                tempEndorsements = this.$root.my_endorsements.slice(0, (this.$root.my_endorsements.length > 6 ? 6 : this.$root.my_endorsements.length));
            }

            console.log('tempEndorsements', tempEndorsements);

            return tempEndorsements;
        },
        followedCount() {
            this
        }
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
            const index = this.endorsements.findIndex(item => item.id === id);
            this.$root.remove_account_endorsement(this.endorsements[index].id).then((response) => {
                if (response !== null) {
                    // add the item to the followed list
                    if (this.$root.my_followed.findIndex(item => item.id === id) == -1) {
                        this.$root.my_followed.unshift(this.endorsements[index]);
                    }
                    // remove the indexed item from this.endorsements
                    this.$root.my_endorsements.splice(index, 1);
                    this.endorsements.splice(index, 1);
                    localStorage.my_endorsements = JSON.stringify(this.$root.my_endorsements);
                }
            })
        },
        refresh() {
            this.loading_endorsements = true;
            console.log('local', this.loading_endorsements);
            this.$root.total_endorsements_loaded = 0;
            this.$root.get_account_endorsements(this.$root.user_id, true).then((response) => {
                this.endorsements = this.$root.my_endorsements;
            });
            this.loading_endorsements = false;
        },
    },

}),

app.component('followed', {
    template: '#followed-template',
    data() {
        return {
            searchValue: ''
        }
    },
    props: {
        followed: {
            type: Array,
            required: true
        },
        total_followed_loaded: {
            type: Number,
            required: true
        },
        loading_followed: {
            type: Boolean,
            required: true
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
                tempFollowed = this.$root.my_followed.filter((item) => {
                    return item.display_name.toLowerCase().includes(this.searchValue.toLowerCase()) || item.acct.toLowerCase().includes(this.searchValue.toLowerCase());
                });
            }

            console.log('tempFollowed', tempFollowed);

            return tempFollowed;
        },
        followedCount() {
            this
        }
    },
    methods: {
        pin(id) {
            console.log('pin', id );
            const index = this.followed.findIndex(item => item.id === id);
            // add the item to the followed list
            this.$root.set_account_endorsement(this.$root.my_followed[index].id).then((response) => {
                if (response !== null) {
                    // Add the item to the top of the endorsements list
                    this.$root.my_endorsements.unshift(this.$root.my_followed[index]);
                    localStorage.my_endorsements = JSON.stringify(this.$root.my_endorsements);
                    // remove the indexed item from this.followed
                    this.$root.my_followed.splice(index, 1);
                    this.followed.splice(index, 1);
                    localStorage.my_followed = JSON.stringify(this.$root.my_followed);
                }
            })
        },
        refresh() {
            this.loading_followed = true;
            console.log('local', this.loading_followed);
            this.$root.total_followed_loaded = 0;
            this.$root.get_followed(this.$root.user_id, true).then((response) => {
                this.followed = this.$root.my_followed;
            });
            this.loading_followed = false;
        },
    }
}),

app.mount('#app')

