"use strict";

const assert = require("node:assert/strict");

const MockDate = require("mockdate");

const {mock_esm, zrequire} = require("./lib/namespace.cjs");
const {make_stub} = require("./lib/stub.cjs");
const {run_test, noop} = require("./lib/test.cjs");

const browser_history = mock_esm("../src/browser_history");
const compose_notifications = mock_esm("../src/compose_notifications");
const hash_util = mock_esm("../src/hash_util");
const markdown = mock_esm("../src/markdown");
const message_lists = mock_esm("../src/message_lists");
const message_events_util = mock_esm("../src/message_events_util");

let disparities = [];

mock_esm("../src/message_live_update", {
    update_message_in_all_views() {},
});

mock_esm("../src/sent_messages", {
    mark_disparity(local_id) {
        disparities.push(local_id);
    },
    report_event_received() {},
});

const message_store = mock_esm("../src/message_store", {
    get: () => ({failed_request: true}),

    update_booleans() {},

    convert_raw_message_to_message_with_booleans() {},
});

message_lists.current = {
    view: {
        rerender_messages: noop,
        change_message_id: noop,
    },
    data: {
        filter: {
            can_apply_locally() {
                return true;
            },
            has_exactly_channel_topic_operators() {
                return true;
            },
            adjust_with_operand_to_message: noop,
            terms: noop,
        },
    },
    change_message_id: noop,
    add_messages: noop,
};
const home_msg_list = {
    view: {
        rerender_messages: noop,
        change_message_id: noop,
    },
    data: {
        filter: {
            can_apply_locally() {
                return true;
            },
        },
    },
    preserver_rendered_state: true,
    change_message_id: noop,
    add_messages: noop,
};
message_lists.all_rendered_message_lists = () => [home_msg_list, message_lists.current];
message_lists.non_rendered_data = () => [];

const echo = zrequire("echo");
const echo_state = zrequire("echo_state");
const people = zrequire("people");
const {set_current_user} = zrequire("state_data");
const stream_data = zrequire("stream_data");
const stream_topic_history = zrequire("stream_topic_history");

const current_user = {};
set_current_user(current_user);

const general_sub = {
    stream_id: 101,
    name: "general",
    subscribed: true,
};
stream_data.add_sub(general_sub);

run_test("process_from_server for un-echoed messages", () => {
    const waiting_for_ack = new Map();
    const server_messages = [
        {
            local_id: "100.1",
        },
    ];
    echo_state._patch_waiting_for_ack(waiting_for_ack);
    const non_echo_messages = echo.process_from_server(server_messages);
    assert.deepEqual(non_echo_messages, server_messages);
});

run_test("process_from_server for differently rendered messages", ({override}) => {
    let messages_to_rerender = [];

    override(home_msg_list.view, "rerender_messages", (msgs) => {
        messages_to_rerender = msgs;
    });

    // Test that we update all the booleans and the content of the message
    // in local echo.
    const old_value = "old_value";
    const new_value = "new_value";
    const waiting_for_ack = new Map([
        [
            "100.1",
            {
                content: "<p>A client rendered message</p>",
                timestamp: old_value,
                is_me_message: old_value,
                submessages: old_value,
                topic_links: old_value,
            },
        ],
    ]);
    const server_messages = [
        {
            local_id: "100.1",
            content: "<p>A server rendered message</p>",
            timestamp: new_value,
            is_me_message: new_value,
            submessages: new_value,
            topic_links: new_value,
        },
    ];
    echo_state._patch_waiting_for_ack(waiting_for_ack);
    disparities = [];
    const non_echo_messages = echo.process_from_server(server_messages);
    assert.deepEqual(non_echo_messages, []);
    assert.equal(disparities.length, 1);
    assert.deepEqual(messages_to_rerender, [
        {
            content: server_messages[0].content,
            timestamp: new_value,
            is_me_message: new_value,
            submessages: new_value,
            topic_links: new_value,
        },
    ]);
});

run_test("process_from_server for messages to add to narrow", ({override}) => {
    let messages_to_add_to_narrow = [];

    override(message_lists.current.data.filter, "can_apply_locally", () => false);
    override(message_events_util, "maybe_add_narrowed_messages", (msgs, msg_list) => {
        messages_to_add_to_narrow = msgs;
        assert.equal(msg_list, message_lists.current);
    });

    const old_value = "old_value";
    const new_value = "new_value";
    const waiting_for_ack = new Map([
        [
            "100.1",
            {
                content: "<p>rendered message</p>",
                timestamp: old_value,
                is_me_message: old_value,
                submessages: old_value,
                topic_links: old_value,
            },
        ],
    ]);
    const server_messages = [
        {
            local_id: "100.1",
            content: "<p>rendered message</p>",
            timestamp: new_value,
            is_me_message: new_value,
            submessages: new_value,
            topic_links: new_value,
        },
    ];
    echo_state._patch_waiting_for_ack(waiting_for_ack);
    const non_echo_messages = echo.process_from_server(server_messages);
    assert.deepEqual(non_echo_messages, []);
    assert.deepEqual(messages_to_add_to_narrow, [
        {
            content: server_messages[0].content,
            timestamp: new_value,
            is_me_message: new_value,
            submessages: new_value,
            topic_links: new_value,
        },
    ]);
});

run_test("build_display_recipient", ({override}) => {
    override(current_user, "user_id", 123);

    const params = {};
    params.realm_users = [
        {
            user_id: 123,
            full_name: "Iago",
            email: "iago@zulip.com",
        },
        {
            email: "cordelia@zulip.com",
            full_name: "Cordelia",
            user_id: 21,
        },
    ];
    const user_group_params = {
        realm_user_groups: [
            {
                is_system_group: true,
                members: [123, 21],
            },
        ],
    };
    params.realm_non_active_users = [];
    params.cross_realm_bots = [];
    people.initialize(current_user.user_id, params, user_group_params);

    let message = {
        type: "stream",
        stream_id: general_sub.stream_id,
        sender_email: "iago@zulip.com",
        sender_full_name: "Iago",
        sender_id: 123,
    };
    let display_recipient = echo.build_display_recipient(message);
    assert.equal(display_recipient, "general");

    message = {
        type: "private",
        to_user_ids: "21",
        private_message_recipient: "cordelia@zulip.com",
        sender_email: "iago@zulip.com",
        sender_full_name: "Iago",
        sender_id: 123,
    };
    display_recipient = echo.build_display_recipient(message);
    assert.equal(display_recipient.length, 2);

    let iago = display_recipient.find((recipient) => recipient.email === "iago@zulip.com");
    assert.equal(iago.full_name, "Iago");
    assert.equal(iago.id, 123);

    const cordelia = display_recipient.find(
        (recipient) => recipient.email === "cordelia@zulip.com",
    );
    assert.equal(cordelia.full_name, "Cordelia");
    assert.equal(cordelia.id, 21);

    message = {
        type: "private",
        to_user_ids: "123",
        private_message_recipient: "iago@zulip.com",
        sender_email: "iago@zulip.com",
        sender_full_name: "Iago",
        sender_id: 123,
    };
    display_recipient = echo.build_display_recipient(message);

    assert.equal(display_recipient.length, 1);
    iago = display_recipient.find((recipient) => recipient.email === "iago@zulip.com");
    assert.equal(iago.full_name, "Iago");
    assert.equal(iago.id, 123);
});

run_test("update_message_lists", () => {
    home_msg_list.view = {};

    const stub = make_stub();
    const view_stub = make_stub();

    home_msg_list.change_message_id = stub.f;
    home_msg_list.view.change_message_id = view_stub.f;

    echo.update_message_lists({old_id: 401, new_id: 402});

    assert.equal(stub.num_calls, 1);
    const args = stub.get_args("old", "new");
    assert.equal(args.old, 401);
    assert.equal(args.new, 402);

    assert.equal(view_stub.num_calls, 1);
    const view_args = view_stub.get_args("old", "new");
    assert.equal(view_args.old, 401);
    assert.equal(view_args.new, 402);
});

run_test("insert_local_message streams", ({override}) => {
    const fake_now = 555;
    MockDate.set(new Date(fake_now * 1000));

    const local_id_float = 101.01;

    let render_called = false;
    let get_topic_links_called = false;
    let insert_message_called = false;

    override(markdown, "render", () => {
        render_called = true;
    });

    override(markdown, "get_topic_links", () => {
        get_topic_links_called = true;
    });

    const insert_new_messages = ([message]) => {
        assert.equal(message.display_recipient, "general");
        assert.equal(message.timestamp, fake_now);
        assert.equal(message.sender_email, "iago@zulip.com");
        assert.equal(message.sender_full_name, "Iago");
        assert.equal(message.sender_id, 123);
        insert_message_called = true;
        return [message];
    };

    const message_request = {
        type: "stream",
        stream_id: general_sub.stream_id,
        topic: "important note",
        sender_email: "iago@zulip.com",
        sender_full_name: "Iago",
        sender_id: 123,
    };
    echo.insert_local_message(message_request, local_id_float, insert_new_messages);

    assert.ok(render_called);
    assert.ok(get_topic_links_called);
    assert.ok(insert_message_called);
});

run_test("insert_local_message direct message", ({override}) => {
    const local_id_float = 102.01;

    override(current_user, "user_id", 123);

    const params = {};
    params.realm_users = [
        {
            user_id: 123,
            full_name: "Iago",
            email: "iago@zulip.com",
        },
        {
            email: "cordelia@zulip.com",
            full_name: "Cordelia",
            user_id: 21,
        },
    ];
    const user_group_params = {
        realm_user_groups: [
            {
                is_system_group: true,
                members: [123, 21],
            },
        ],
    };
    params.realm_non_active_users = [];
    params.cross_realm_bots = [];
    people.init();
    people.initialize(current_user.user_id, params, user_group_params);

    let render_called = false;
    let insert_message_called = false;

    const insert_new_messages = ([message]) => {
        assert.equal(message.display_recipient.length, 2);
        insert_message_called = true;
        return [message];
    };

    override(markdown, "render", () => {
        render_called = true;
    });

    const message_request = {
        private_message_recipient: "cordelia@zulip.com",
        to_user_ids: "21",
        type: "private",
        sender_email: "iago@zulip.com",
        sender_full_name: "Iago",
        sender_id: 123,
    };
    echo.insert_local_message(message_request, local_id_float, insert_new_messages);
    assert.ok(render_called);
    assert.ok(insert_message_called);
});

run_test("test reify_message_id", ({override}) => {
    const local_id_float = 103.01;

    override(markdown, "render", noop);
    override(markdown, "get_topic_links", noop);
    override(hash_util, "search_terms_to_hash", noop);
    override(browser_history, "update_current_history_state_data", noop);

    const message_request = {
        type: "stream",
        stream_id: general_sub.stream_id,
        topic: "test",
        sender_email: "iago@zulip.com",
        sender_full_name: "Iago",
        sender_id: 123,
        draft_id: 100,
    };
    echo.insert_local_message(message_request, local_id_float, (messages) => {
        messages.map((message) => echo.track_local_message(message));
        return messages;
    });

    let message_store_reify_called = false;
    let notifications_reify_called = false;

    override(message_store, "reify_message_id", () => {
        message_store_reify_called = true;
    });

    override(compose_notifications, "reify_message_id", () => {
        notifications_reify_called = true;
    });

    echo.reify_message_id(local_id_float.toString(), 110);

    assert.ok(message_store_reify_called);
    assert.ok(notifications_reify_called);

    const history = stream_topic_history.find_or_create(general_sub.stream_id);
    assert.equal(history.max_message_id, 110);
    assert.equal(history.topics.get("test").message_id, 110);
});

run_test("reset MockDate", () => {
    MockDate.reset();
});
