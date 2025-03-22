// New Block - Updated March 22, 2025
function noop() { }
function run(fn) {
    return fn();
}
function blank_object() {
    return Object.create(null);
}
function run_all(fns) {
    fns.forEach(run);
}
function is_function(thing) {
    return typeof thing === 'function';
}
function safe_not_equal(a, b) {
    return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}
let src_url_equal_anchor;
function src_url_equal(element_src, url) {
    if (!src_url_equal_anchor) {
        src_url_equal_anchor = document.createElement('a');
    }
    src_url_equal_anchor.href = url;
    return element_src === src_url_equal_anchor.href;
}
function is_empty(obj) {
    return Object.keys(obj).length === 0;
}

// Track which nodes are claimed during hydration. Unclaimed nodes can then be removed from the DOM
// at the end of hydration without touching the remaining nodes.
let is_hydrating = false;
function start_hydrating() {
    is_hydrating = true;
}
function end_hydrating() {
    is_hydrating = false;
}
function upper_bound(low, high, key, value) {
    // Return first index of value larger than input value in the range [low, high)
    while (low < high) {
        const mid = low + ((high - low) >> 1);
        if (key(mid) <= value) {
            low = mid + 1;
        }
        else {
            high = mid;
        }
    }
    return low;
}
function init_hydrate(target) {
    if (target.hydrate_init)
        return;
    target.hydrate_init = true;
    // We know that all children have claim_order values since the unclaimed have been detached if target is not <head>
    let children = target.childNodes;
    // If target is <head>, there may be children without claim_order
    if (target.nodeName === 'HEAD') {
        const myChildren = [];
        for (let i = 0; i < children.length; i++) {
            const node = children[i];
            if (node.claim_order !== undefined) {
                myChildren.push(node);
            }
        }
        children = myChildren;
    }
    /*
    * Reorder claimed children optimally.
    * We can reorder claimed children optimally by finding the longest subsequence of
    * nodes that are already claimed in order and only moving the rest. The longest
    * subsequence of nodes that are claimed in order can be found by
    * computing the longest increasing subsequence of .claim_order values.
    *
    * This algorithm is optimal in generating the least amount of reorder operations
    * possible.
    *
    * Proof:
    * We know that, given a set of reordering operations, the nodes that do not move
    * always form an increasing subsequence, since they do not move among each other
    * meaning that they must be already ordered among each other. Thus, the maximal
    * set of nodes that do not move form a longest increasing subsequence.
    */
    // Compute longest increasing subsequence
    // m: subsequence length j => index k of smallest value that ends an increasing subsequence of length j
    const m = new Int32Array(children.length + 1);
    // Predecessor indices + 1
    const p = new Int32Array(children.length);
    m[0] = -1;
    let longest = 0;
    for (let i = 0; i < children.length; i++) {
        const current = children[i].claim_order;
        // Find the largest subsequence length such that it ends in a value less than our current value
        // upper_bound returns first greater value, so we subtract one
        // with fast path for when we are on the current longest subsequence
        const seqLen = ((longest > 0 && children[m[longest]].claim_order <= current) ? longest + 1 : upper_bound(1, longest, idx => children[m[idx]].claim_order, current)) - 1;
        p[i] = m[seqLen] + 1;
        const newLen = seqLen + 1;
        // We can guarantee that current is the smallest value. Otherwise, we would have generated a longer sequence.
        m[newLen] = i;
        longest = Math.max(newLen, longest);
    }
    // The longest increasing subsequence of nodes (initially reversed)
    const lis = [];
    // The rest of the nodes, nodes that will be moved
    const toMove = [];
    let last = children.length - 1;
    for (let cur = m[longest] + 1; cur != 0; cur = p[cur - 1]) {
        lis.push(children[cur - 1]);
        for (; last >= cur; last--) {
            toMove.push(children[last]);
        }
        last--;
    }
    for (; last >= 0; last--) {
        toMove.push(children[last]);
    }
    lis.reverse();
    // We sort the nodes being moved to guarantee that their insertion order matches the claim order
    toMove.sort((a, b) => a.claim_order - b.claim_order);
    // Finally, we move the nodes
    for (let i = 0, j = 0; i < toMove.length; i++) {
        while (j < lis.length && toMove[i].claim_order >= lis[j].claim_order) {
            j++;
        }
        const anchor = j < lis.length ? lis[j] : null;
        target.insertBefore(toMove[i], anchor);
    }
}
function append_hydration(target, node) {
    if (is_hydrating) {
        init_hydrate(target);
        if ((target.actual_end_child === undefined) || ((target.actual_end_child !== null) && (target.actual_end_child.parentNode !== target))) {
            target.actual_end_child = target.firstChild;
        }
        // Skip nodes of undefined ordering
        while ((target.actual_end_child !== null) && (target.actual_end_child.claim_order === undefined)) {
            target.actual_end_child = target.actual_end_child.nextSibling;
        }
        if (node !== target.actual_end_child) {
            // We only insert if the ordering of this node should be modified or the parent node is not target
            if (node.claim_order !== undefined || node.parentNode !== target) {
                target.insertBefore(node, target.actual_end_child);
            }
        }
        else {
            target.actual_end_child = node.nextSibling;
        }
    }
    else if (node.parentNode !== target || node.nextSibling !== null) {
        target.appendChild(node);
    }
}
function insert_hydration(target, node, anchor) {
    if (is_hydrating && !anchor) {
        append_hydration(target, node);
    }
    else if (node.parentNode !== target || node.nextSibling != anchor) {
        target.insertBefore(node, anchor || null);
    }
}
function detach(node) {
    if (node.parentNode) {
        node.parentNode.removeChild(node);
    }
}
function element(name) {
    return document.createElement(name);
}
function text(data) {
    return document.createTextNode(data);
}
function space() {
    return text(' ');
}
function listen(node, event, handler, options) {
    node.addEventListener(event, handler, options);
    return () => node.removeEventListener(event, handler, options);
}
function attr(node, attribute, value) {
    if (value == null)
        node.removeAttribute(attribute);
    else if (node.getAttribute(attribute) !== value)
        node.setAttribute(attribute, value);
}
function children(element) {
    return Array.from(element.childNodes);
}
function init_claim_info(nodes) {
    if (nodes.claim_info === undefined) {
        nodes.claim_info = { last_index: 0, total_claimed: 0 };
    }
}
function claim_node(nodes, predicate, processNode, createNode, dontUpdateLastIndex = false) {
    // Try to find nodes in an order such that we lengthen the longest increasing subsequence
    init_claim_info(nodes);
    const resultNode = (() => {
        // We first try to find an element after the previous one
        for (let i = nodes.claim_info.last_index; i < nodes.length; i++) {
            const node = nodes[i];
            if (predicate(node)) {
                const replacement = processNode(node);
                if (replacement === undefined) {
                    nodes.splice(i, 1);
                }
                else {
                    nodes[i] = replacement;
                }
                if (!dontUpdateLastIndex) {
                    nodes.claim_info.last_index = i;
                }
                return node;
            }
        }
        // Otherwise, we try to find one before
        // We iterate in reverse so that we don't go too far back
        for (let i = nodes.claim_info.last_index - 1; i >= 0; i--) {
            const node = nodes[i];
            if (predicate(node)) {
                const replacement = processNode(node);
                if (replacement === undefined) {
                    nodes.splice(i, 1);
                }
                else {
                    nodes[i] = replacement;
                }
                if (!dontUpdateLastIndex) {
                    nodes.claim_info.last_index = i;
                }
                else if (replacement === undefined) {
                    // Since we spliced before the last_index, we decrease it
                    nodes.claim_info.last_index--;
                }
                return node;
            }
        }
        // If we can't find any matching node, we create a new one
        return createNode();
    })();
    resultNode.claim_order = nodes.claim_info.total_claimed;
    nodes.claim_info.total_claimed += 1;
    return resultNode;
}
function claim_element_base(nodes, name, attributes, create_element) {
    return claim_node(nodes, (node) => node.nodeName === name, (node) => {
        const remove = [];
        for (let j = 0; j < node.attributes.length; j++) {
            const attribute = node.attributes[j];
            if (!attributes[attribute.name]) {
                remove.push(attribute.name);
            }
        }
        remove.forEach(v => node.removeAttribute(v));
        return undefined;
    }, () => create_element(name));
}
function claim_element(nodes, name, attributes) {
    return claim_element_base(nodes, name, attributes, element);
}
function claim_text(nodes, data) {
    return claim_node(nodes, (node) => node.nodeType === 3, (node) => {
        const dataStr = '' + data;
        if (node.data.startsWith(dataStr)) {
            if (node.data.length !== dataStr.length) {
                return node.splitText(dataStr.length);
            }
        }
        else {
            node.data = dataStr;
        }
    }, () => text(data), true // Text nodes should not update last index since it is likely not worth it to eliminate an increasing subsequence of actual elements
    );
}
function claim_space(nodes) {
    return claim_text(nodes, ' ');
}
function set_style(node, key, value, important) {
    if (value == null) {
        node.style.removeProperty(key);
    }
    else {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
}

let current_component;
function set_current_component(component) {
    current_component = component;
}

const dirty_components = [];
const binding_callbacks = [];
let render_callbacks = [];
const flush_callbacks = [];
const resolved_promise = /* @__PURE__ */ Promise.resolve();
let update_scheduled = false;
function schedule_update() {
    if (!update_scheduled) {
        update_scheduled = true;
        resolved_promise.then(flush);
    }
}
function add_render_callback(fn) {
    render_callbacks.push(fn);
}
// flush() calls callbacks in this order:
// 1. All beforeUpdate callbacks, in order: parents before children
// 2. All bind:this callbacks, in reverse order: children before parents.
// 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
//    for afterUpdates called during the initial onMount, which are called in
//    reverse order: children before parents.
// Since callbacks might update component values, which could trigger another
// call to flush(), the following steps guard against this:
// 1. During beforeUpdate, any updated components will be added to the
//    dirty_components array and will cause a reentrant call to flush(). Because
//    the flush index is kept outside the function, the reentrant call will pick
//    up where the earlier call left off and go through all dirty components. The
//    current_component value is saved and restored so that the reentrant call will
//    not interfere with the "parent" flush() call.
// 2. bind:this callbacks cannot trigger new flush() calls.
// 3. During afterUpdate, any updated components will NOT have their afterUpdate
//    callback called a second time; the seen_callbacks set, outside the flush()
//    function, guarantees this behavior.
const seen_callbacks = new Set();
let flushidx = 0; // Do *not* move this inside the flush() function
function flush() {
    // Do not reenter flush while dirty components are updated, as this can
    // result in an infinite loop. Instead, let the inner flush handle it.
    // Reentrancy is ok afterwards for bindings etc.
    if (flushidx !== 0) {
        return;
    }
    const saved_component = current_component;
    do {
        // first, call beforeUpdate functions
        // and update components
        try {
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
        }
        catch (e) {
            // reset dirty state to not end up in a deadlocked state and then rethrow
            dirty_components.length = 0;
            flushidx = 0;
            throw e;
        }
        set_current_component(null);
        dirty_components.length = 0;
        flushidx = 0;
        while (binding_callbacks.length)
            binding_callbacks.pop()();
        // then, once components are updated, call
        // afterUpdate functions. This may cause
        // subsequent updates...
        for (let i = 0; i < render_callbacks.length; i += 1) {
            const callback = render_callbacks[i];
            if (!seen_callbacks.has(callback)) {
                // ...so guard against infinite loops
                seen_callbacks.add(callback);
                callback();
            }
        }
        render_callbacks.length = 0;
    } while (dirty_components.length);
    while (flush_callbacks.length) {
        flush_callbacks.pop()();
    }
    update_scheduled = false;
    seen_callbacks.clear();
    set_current_component(saved_component);
}
function update($$) {
    if ($$.fragment !== null) {
        $$.update();
        run_all($$.before_update);
        const dirty = $$.dirty;
        $$.dirty = [-1];
        $$.fragment && $$.fragment.p($$.ctx, dirty);
        $$.after_update.forEach(add_render_callback);
    }
}
/**
 * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
 */
function flush_render_callbacks(fns) {
    const filtered = [];
    const targets = [];
    render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
    targets.forEach((c) => c());
    render_callbacks = filtered;
}
const outroing = new Set();
function transition_in(block, local) {
    if (block && block.i) {
        outroing.delete(block);
        block.i(local);
    }
}
function mount_component(component, target, anchor, customElement) {
    const { fragment, after_update } = component.$$;
    fragment && fragment.m(target, anchor);
    if (!customElement) {
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
            // if the component was destroyed immediately
            // it will update the `$$.on_destroy` reference to `null`.
            // the destructured on_destroy may still reference to the old array
            if (component.$$.on_destroy) {
                component.$$.on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
    }
    after_update.forEach(add_render_callback);
}
function destroy_component(component, detaching) {
    const $$ = component.$$;
    if ($$.fragment !== null) {
        flush_render_callbacks($$.after_update);
        run_all($$.on_destroy);
        $$.fragment && $$.fragment.d(detaching);
        // TODO null out other refs, including component.$$ (but need to
        // preserve final state?)
        $$.on_destroy = $$.fragment = null;
        $$.ctx = [];
    }
}
function make_dirty(component, i) {
    if (component.$$.dirty[0] === -1) {
        dirty_components.push(component);
        schedule_update();
        component.$$.dirty.fill(0);
    }
    component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
}
function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
    const parent_component = current_component;
    set_current_component(component);
    const $$ = component.$$ = {
        fragment: null,
        ctx: [],
        // state
        props,
        update: noop,
        not_equal,
        bound: blank_object(),
        // lifecycle
        on_mount: [],
        on_destroy: [],
        on_disconnect: [],
        before_update: [],
        after_update: [],
        context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
        // everything else
        callbacks: blank_object(),
        dirty,
        skip_bound: false,
        root: options.target || parent_component.$$.root
    };
    append_styles && append_styles($$.root);
    let ready = false;
    $$.ctx = instance
        ? instance(component, options.props || {}, (i, ret, ...rest) => {
            const value = rest.length ? rest[0] : ret;
            if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                if (!$$.skip_bound && $$.bound[i])
                    $$.bound[i](value);
                if (ready)
                    make_dirty(component, i);
            }
            return ret;
        })
        : [];
    $$.update();
    ready = true;
    run_all($$.before_update);
    // `false` as a special case of no DOM component
    $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
    if (options.target) {
        if (options.hydrate) {
            start_hydrating();
            const nodes = children(options.target);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.l(nodes);
            nodes.forEach(detach);
        }
        else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.c();
        }
        if (options.intro)
            transition_in(component.$$.fragment);
        mount_component(component, options.target, options.anchor, options.customElement);
        end_hydrating();
        flush();
    }
    set_current_component(parent_component);
}
/**
 * Base class for Svelte components. Used when dev=false.
 */
class SvelteComponent {
    $destroy() {
        destroy_component(this, 1);
        this.$destroy = noop;
    }
    $on(type, callback) {
        if (!is_function(callback)) {
            return noop;
        }
        const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
        callbacks.push(callback);
        return () => {
            const index = callbacks.indexOf(callback);
            if (index !== -1)
                callbacks.splice(index, 1);
        };
    }
    $set($$props) {
        if (this.$$set && !is_empty($$props)) {
            this.$$.skip_bound = true;
            this.$$set($$props);
            this.$$.skip_bound = false;
        }
    }
}

/* generated by Svelte v3.59.1 */

function create_fragment(ctx) {
	let main;
	let div8;
	let header;
	let h1;
	let t0;
	let t1;
	let p0;
	let t2;
	let t3;
	let div0;
	let img;
	let img_src_value;
	let t4;
	let div4;
	let div1;
	let h20;
	let t5_value = /*formatCurrency*/ ctx[2](raised) + "";
	let t5;
	let t6;
	let p1;
	let t7;
	let t8_value = /*formatCurrency*/ ctx[2](goal) + "";
	let t8;
	let t9;
	let t10;
	let div3;
	let div2;
	let t11;
	let p2;
	let t12;
	let t13;
	let t14;
	let div5;
	let h21;
	let t15;
	let t16;
	let p3;
	let t17;
	let t18;
	let form;
	let input0;
	let t19;
	let input1;
	let t20;
	let input2;
	let t21;
	let button0;
	let t22;
	let t23;
	let div6;
	let h22;
	let t24;
	let t25;
	let p4;
	let t26;
	let t27;
	let p5;
	let t28;
	let t29;
	let div7;
	let h23;
	let t30;
	let t31;
	let p6;
	let t32;
	let t33;
	let button1;
	let t34;
	let t35;
	let p7;
	let t36;
	let a;
	let t37;
	let mounted;
	let dispose;

	return {
		c() {
			main = element("main");
			div8 = element("div");
			header = element("header");
			h1 = element("h1");
			t0 = text("Churchtown Primary School Fundraiser");
			t1 = space();
			p0 = element("p");
			t2 = text("Help us improve our school facilities for all children");
			t3 = space();
			div0 = element("div");
			img = element("img");
			t4 = space();
			div4 = element("div");
			div1 = element("div");
			h20 = element("h2");
			t5 = text(t5_value);
			t6 = space();
			p1 = element("p");
			t7 = text("raised of ");
			t8 = text(t8_value);
			t9 = text(" goal");
			t10 = space();
			div3 = element("div");
			div2 = element("div");
			t11 = space();
			p2 = element("p");
			t12 = text(donors);
			t13 = text(" donors have contributed");
			t14 = space();
			div5 = element("div");
			h21 = element("h2");
			t15 = text("Make a Donation");
			t16 = space();
			p3 = element("p");
			t17 = text("Your contribution will make a difference to our school community.");
			t18 = space();
			form = element("form");
			input0 = element("input");
			t19 = space();
			input1 = element("input");
			t20 = space();
			input2 = element("input");
			t21 = space();
			button0 = element("button");
			t22 = text("Donate with PayPal");
			t23 = space();
			div6 = element("div");
			h22 = element("h2");
			t24 = text("About Our Fundraiser");
			t25 = space();
			p4 = element("p");
			t26 = text("We're raising funds to improve the playground facilities at Churchtown Primary School. \n        Our goal is to create a safe, engaging outdoor space where children can play and learn.\n        The new playground will include accessible equipment for children of all abilities.");
			t27 = space();
			p5 = element("p");
			t28 = text("Every donation, no matter how small, brings us closer to our goal. \n        Thank you for supporting our school community!");
			t29 = space();
			div7 = element("div");
			h23 = element("h2");
			t30 = text("Contact Us");
			t31 = space();
			p6 = element("p");
			t32 = text("Have questions about our fundraiser? Get in touch with us:");
			t33 = space();
			button1 = element("button");
			t34 = text("Contact via WhatsApp");
			t35 = space();
			p7 = element("p");
			t36 = text("Or email us at: ");
			a = element("a");
			t37 = text("fundraising@churchtownprimary.example");
			this.h();
		},
		l(nodes) {
			main = claim_element(nodes, "MAIN", {});
			var main_nodes = children(main);
			div8 = claim_element(main_nodes, "DIV", { class: true });
			var div8_nodes = children(div8);
			header = claim_element(div8_nodes, "HEADER", { class: true });
			var header_nodes = children(header);
			h1 = claim_element(header_nodes, "H1", { class: true });
			var h1_nodes = children(h1);
			t0 = claim_text(h1_nodes, "Churchtown Primary School Fundraiser");
			h1_nodes.forEach(detach);
			t1 = claim_space(header_nodes);
			p0 = claim_element(header_nodes, "P", { class: true });
			var p0_nodes = children(p0);
			t2 = claim_text(p0_nodes, "Help us improve our school facilities for all children");
			p0_nodes.forEach(detach);
			header_nodes.forEach(detach);
			t3 = claim_space(div8_nodes);
			div0 = claim_element(div8_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);
			img = claim_element(div0_nodes, "IMG", { src: true, alt: true, class: true });
			div0_nodes.forEach(detach);
			t4 = claim_space(div8_nodes);
			div4 = claim_element(div8_nodes, "DIV", { class: true });
			var div4_nodes = children(div4);
			div1 = claim_element(div4_nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			h20 = claim_element(div1_nodes, "H2", { class: true });
			var h20_nodes = children(h20);
			t5 = claim_text(h20_nodes, t5_value);
			h20_nodes.forEach(detach);
			t6 = claim_space(div1_nodes);
			p1 = claim_element(div1_nodes, "P", { class: true });
			var p1_nodes = children(p1);
			t7 = claim_text(p1_nodes, "raised of ");
			t8 = claim_text(p1_nodes, t8_value);
			t9 = claim_text(p1_nodes, " goal");
			p1_nodes.forEach(detach);
			div1_nodes.forEach(detach);
			t10 = claim_space(div4_nodes);
			div3 = claim_element(div4_nodes, "DIV", { class: true });
			var div3_nodes = children(div3);
			div2 = claim_element(div3_nodes, "DIV", { class: true, style: true });
			children(div2).forEach(detach);
			div3_nodes.forEach(detach);
			t11 = claim_space(div4_nodes);
			p2 = claim_element(div4_nodes, "P", { class: true });
			var p2_nodes = children(p2);
			t12 = claim_text(p2_nodes, donors);
			t13 = claim_text(p2_nodes, " donors have contributed");
			p2_nodes.forEach(detach);
			div4_nodes.forEach(detach);
			t14 = claim_space(div8_nodes);
			div5 = claim_element(div8_nodes, "DIV", { class: true });
			var div5_nodes = children(div5);
			h21 = claim_element(div5_nodes, "H2", {});
			var h21_nodes = children(h21);
			t15 = claim_text(h21_nodes, "Make a Donation");
			h21_nodes.forEach(detach);
			t16 = claim_space(div5_nodes);
			p3 = claim_element(div5_nodes, "P", {});
			var p3_nodes = children(p3);
			t17 = claim_text(p3_nodes, "Your contribution will make a difference to our school community.");
			p3_nodes.forEach(detach);
			t18 = claim_space(div5_nodes);
			form = claim_element(div5_nodes, "FORM", { action: true, method: true, target: true });
			var form_nodes = children(form);
			input0 = claim_element(form_nodes, "INPUT", { type: true, name: true });
			t19 = claim_space(form_nodes);
			input1 = claim_element(form_nodes, "INPUT", { type: true, name: true });
			t20 = claim_space(form_nodes);
			input2 = claim_element(form_nodes, "INPUT", { type: true, name: true });
			t21 = claim_space(form_nodes);
			button0 = claim_element(form_nodes, "BUTTON", { type: true, class: true });
			var button0_nodes = children(button0);
			t22 = claim_text(button0_nodes, "Donate with PayPal");
			button0_nodes.forEach(detach);
			form_nodes.forEach(detach);
			div5_nodes.forEach(detach);
			t23 = claim_space(div8_nodes);
			div6 = claim_element(div8_nodes, "DIV", { class: true });
			var div6_nodes = children(div6);
			h22 = claim_element(div6_nodes, "H2", {});
			var h22_nodes = children(h22);
			t24 = claim_text(h22_nodes, "About Our Fundraiser");
			h22_nodes.forEach(detach);
			t25 = claim_space(div6_nodes);
			p4 = claim_element(div6_nodes, "P", {});
			var p4_nodes = children(p4);
			t26 = claim_text(p4_nodes, "We're raising funds to improve the playground facilities at Churchtown Primary School. \n        Our goal is to create a safe, engaging outdoor space where children can play and learn.\n        The new playground will include accessible equipment for children of all abilities.");
			p4_nodes.forEach(detach);
			t27 = claim_space(div6_nodes);
			p5 = claim_element(div6_nodes, "P", {});
			var p5_nodes = children(p5);
			t28 = claim_text(p5_nodes, "Every donation, no matter how small, brings us closer to our goal. \n        Thank you for supporting our school community!");
			p5_nodes.forEach(detach);
			div6_nodes.forEach(detach);
			t29 = claim_space(div8_nodes);
			div7 = claim_element(div8_nodes, "DIV", { class: true });
			var div7_nodes = children(div7);
			h23 = claim_element(div7_nodes, "H2", {});
			var h23_nodes = children(h23);
			t30 = claim_text(h23_nodes, "Contact Us");
			h23_nodes.forEach(detach);
			t31 = claim_space(div7_nodes);
			p6 = claim_element(div7_nodes, "P", {});
			var p6_nodes = children(p6);
			t32 = claim_text(p6_nodes, "Have questions about our fundraiser? Get in touch with us:");
			p6_nodes.forEach(detach);
			t33 = claim_space(div7_nodes);
			button1 = claim_element(div7_nodes, "BUTTON", { class: true });
			var button1_nodes = children(button1);
			t34 = claim_text(button1_nodes, "Contact via WhatsApp");
			button1_nodes.forEach(detach);
			t35 = claim_space(div7_nodes);
			p7 = claim_element(div7_nodes, "P", { class: true });
			var p7_nodes = children(p7);
			t36 = claim_text(p7_nodes, "Or email us at: ");
			a = claim_element(p7_nodes, "A", { href: true, class: true });
			var a_nodes = children(a);
			t37 = claim_text(a_nodes, "fundraising@churchtownprimary.example");
			a_nodes.forEach(detach);
			p7_nodes.forEach(detach);
			div7_nodes.forEach(detach);
			div8_nodes.forEach(detach);
			main_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(h1, "class", "svelte-1ndvfe3");
			attr(p0, "class", "subtitle svelte-1ndvfe3");
			attr(header, "class", "svelte-1ndvfe3");
			if (!src_url_equal(img.src, img_src_value = /*image*/ ctx[0].url)) attr(img, "src", img_src_value);
			attr(img, "alt", "Churchtown Primary School");
			attr(img, "class", "main-image svelte-1ndvfe3");
			attr(div0, "class", "image-container svelte-1ndvfe3");
			attr(h20, "class", "svelte-1ndvfe3");
			attr(p1, "class", "svelte-1ndvfe3");
			attr(div1, "class", "progress-stats svelte-1ndvfe3");
			attr(div2, "class", "progress-bar svelte-1ndvfe3");
			set_style(div2, "width", /*percentageRaised*/ ctx[1] + "%");
			attr(div3, "class", "progress-container svelte-1ndvfe3");
			attr(p2, "class", "donors svelte-1ndvfe3");
			attr(div4, "class", "progress-section svelte-1ndvfe3");
			attr(input0, "type", "hidden");
			attr(input0, "name", "business");
			input0.value = "schoolfund@example.com";
			attr(input1, "type", "hidden");
			attr(input1, "name", "item_name");
			input1.value = "Churchtown Primary School Donation";
			attr(input2, "type", "hidden");
			attr(input2, "name", "currency_code");
			input2.value = "GBP";
			attr(button0, "type", "submit");
			attr(button0, "class", "donate-button svelte-1ndvfe3");
			attr(form, "action", "https://www.paypal.com/donate");
			attr(form, "method", "post");
			attr(form, "target", "_blank");
			attr(div5, "class", "donation-section svelte-1ndvfe3");
			attr(div6, "class", "info-section svelte-1ndvfe3");
			attr(button1, "class", "whatsapp-button svelte-1ndvfe3");
			attr(a, "href", "mailto:fundraising@churchtownprimary.example");
			attr(a, "class", "svelte-1ndvfe3");
			attr(p7, "class", "email svelte-1ndvfe3");
			attr(div7, "class", "contact-section svelte-1ndvfe3");
			attr(div8, "class", "container svelte-1ndvfe3");
		},
		m(target, anchor) {
			insert_hydration(target, main, anchor);
			append_hydration(main, div8);
			append_hydration(div8, header);
			append_hydration(header, h1);
			append_hydration(h1, t0);
			append_hydration(header, t1);
			append_hydration(header, p0);
			append_hydration(p0, t2);
			append_hydration(div8, t3);
			append_hydration(div8, div0);
			append_hydration(div0, img);
			append_hydration(div8, t4);
			append_hydration(div8, div4);
			append_hydration(div4, div1);
			append_hydration(div1, h20);
			append_hydration(h20, t5);
			append_hydration(div1, t6);
			append_hydration(div1, p1);
			append_hydration(p1, t7);
			append_hydration(p1, t8);
			append_hydration(p1, t9);
			append_hydration(div4, t10);
			append_hydration(div4, div3);
			append_hydration(div3, div2);
			append_hydration(div4, t11);
			append_hydration(div4, p2);
			append_hydration(p2, t12);
			append_hydration(p2, t13);
			append_hydration(div8, t14);
			append_hydration(div8, div5);
			append_hydration(div5, h21);
			append_hydration(h21, t15);
			append_hydration(div5, t16);
			append_hydration(div5, p3);
			append_hydration(p3, t17);
			append_hydration(div5, t18);
			append_hydration(div5, form);
			append_hydration(form, input0);
			append_hydration(form, t19);
			append_hydration(form, input1);
			append_hydration(form, t20);
			append_hydration(form, input2);
			append_hydration(form, t21);
			append_hydration(form, button0);
			append_hydration(button0, t22);
			append_hydration(div8, t23);
			append_hydration(div8, div6);
			append_hydration(div6, h22);
			append_hydration(h22, t24);
			append_hydration(div6, t25);
			append_hydration(div6, p4);
			append_hydration(p4, t26);
			append_hydration(div6, t27);
			append_hydration(div6, p5);
			append_hydration(p5, t28);
			append_hydration(div8, t29);
			append_hydration(div8, div7);
			append_hydration(div7, h23);
			append_hydration(h23, t30);
			append_hydration(div7, t31);
			append_hydration(div7, p6);
			append_hydration(p6, t32);
			append_hydration(div7, t33);
			append_hydration(div7, button1);
			append_hydration(button1, t34);
			append_hydration(div7, t35);
			append_hydration(div7, p7);
			append_hydration(p7, t36);
			append_hydration(p7, a);
			append_hydration(a, t37);

			if (!mounted) {
				dispose = listen(button1, "click", /*openWhatsApp*/ ctx[3]);
				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*image*/ 1 && !src_url_equal(img.src, img_src_value = /*image*/ ctx[0].url)) {
				attr(img, "src", img_src_value);
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(main);
			mounted = false;
			dispose();
		}
	};
}

let goal = 10000;
let raised = 3750;
let donors = 42;

function instance($$self, $$props, $$invalidate) {
	let { props } = $$props;
	let { image } = $$props;
	let percentageRaised = raised / goal * 100;

	// Format currency
	const formatCurrency = amount => {
		return new Intl.NumberFormat('en-GB',
		{
				style: 'currency',
				currency: 'GBP',
				minimumFractionDigits: 0
			}).format(amount);
	};

	// WhatsApp contact function
	const openWhatsApp = () => {
		const message = encodeURIComponent("Hello, I'd like to know more about the fundraising campaign.");
		window.open(`https://wa.me/447123456789?text=${message}`, '_blank');
	};

	$$self.$$set = $$props => {
		if ('props' in $$props) $$invalidate(4, props = $$props.props);
		if ('image' in $$props) $$invalidate(0, image = $$props.image);
	};

	return [image, percentageRaised, formatCurrency, openWhatsApp, props];
}

class Component extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, { props: 4, image: 0 });
	}
}

export { Component as default };
