// New Block - Updated April 6, 2025
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
function destroy_each(iterations, detaching) {
    for (let i = 0; i < iterations.length; i += 1) {
        if (iterations[i])
            iterations[i].d(detaching);
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

function get_each_context(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[9] = list[i];
	child_ctx[11] = i;
	return child_ctx;
}

function get_each_context_1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[9] = list[i];
	child_ctx[11] = i;
	return child_ctx;
}

// (428:12) {#each expenses as expense, i}
function create_each_block_1(ctx) {
	let div;

	return {
		c() {
			div = element("div");
			this.h();
		},
		l(nodes) {
			div = claim_element(nodes, "DIV", { class: true, style: true });
			var div_nodes = children(div);
			div_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(div, "class", "pie-segment svelte-spn9g9");

			set_style(div, "--start", (/*i*/ ctx[11] === 0
			? 0
			: /*expenses*/ ctx[7].slice(0, /*i*/ ctx[11]).reduce(func, 0)) + "%");

			set_style(div, "--end", /*expenses*/ ctx[7].slice(0, /*i*/ ctx[11] + 1).reduce(func_1, 0) + "%");
			set_style(div, "--color", "var(--color-" + (/*i*/ ctx[11] + 1) + ")");
		},
		m(target, anchor) {
			insert_hydration(target, div, anchor);
		},
		p: noop,
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

// (439:12) {#each expenses as expense, i}
function create_each_block(ctx) {
	let div;
	let span0;
	let t0;
	let span1;
	let t1_value = /*expense*/ ctx[9].category + "";
	let t1;
	let t2;
	let t3_value = /*expense*/ ctx[9].percentage + "";
	let t3;
	let t4;
	let t5;

	return {
		c() {
			div = element("div");
			span0 = element("span");
			t0 = space();
			span1 = element("span");
			t1 = text(t1_value);
			t2 = text(": ");
			t3 = text(t3_value);
			t4 = text("%");
			t5 = space();
			this.h();
		},
		l(nodes) {
			div = claim_element(nodes, "DIV", { class: true });
			var div_nodes = children(div);
			span0 = claim_element(div_nodes, "SPAN", { class: true, style: true });
			children(span0).forEach(detach);
			t0 = claim_space(div_nodes);
			span1 = claim_element(div_nodes, "SPAN", {});
			var span1_nodes = children(span1);
			t1 = claim_text(span1_nodes, t1_value);
			t2 = claim_text(span1_nodes, ": ");
			t3 = claim_text(span1_nodes, t3_value);
			t4 = claim_text(span1_nodes, "%");
			span1_nodes.forEach(detach);
			t5 = claim_space(div_nodes);
			div_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(span0, "class", "color-box svelte-spn9g9");
			set_style(span0, "background-color", "var(--color-" + (/*i*/ ctx[11] + 1) + ")");
			attr(div, "class", "legend-item svelte-spn9g9");
		},
		m(target, anchor) {
			insert_hydration(target, div, anchor);
			append_hydration(div, span0);
			append_hydration(div, t0);
			append_hydration(div, span1);
			append_hydration(span1, t1);
			append_hydration(span1, t2);
			append_hydration(span1, t3);
			append_hydration(span1, t4);
			append_hydration(div, t5);
		},
		p: noop,
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

function create_fragment(ctx) {
	let main;
	let div31;
	let header;
	let h1;
	let t0;
	let t1;
	let section0;
	let div0;
	let img0;
	let img0_src_value;
	let img0_alt_value;
	let t2;
	let div1;
	let raw_value = /*contents*/ ctx[1].html + "";
	let t3;
	let section1;
	let h20;
	let t4;
	let t5;
	let ul0;
	let li0;
	let t6;
	let t7;
	let li1;
	let t8;
	let t9;
	let li2;
	let t10;
	let t11;
	let p0;
	let t12;
	let t13;
	let section2;
	let h21;
	let t14;
	let t15;
	let p1;
	let t16;
	let t17;
	let div6;
	let div2;
	let h30;
	let t18;
	let t19;
	let p2;
	let t20;
	let t21;
	let div3;
	let h31;
	let t22;
	let t23;
	let p3;
	let t24;
	let t25;
	let div4;
	let h32;
	let t26;
	let t27;
	let p4;
	let t28;
	let t29;
	let div5;
	let h33;
	let t30;
	let t31;
	let p5;
	let t32;
	let t33;
	let p6;
	let t34;
	let t35;
	let p7;
	let t36;
	let t37;
	let p8;
	let t38;
	let t39;
	let div13;
	let h34;
	let t40;
	let t41_value = /*formatCurrency*/ ctx[5](monthlyGoal) + "";
	let t41;
	let t42;
	let div9;
	let div7;
	let t43;
	let div8;
	let t44;
	let div11;
	let div10;
	let t45;
	let div12;
	let span0;
	let t46_value = /*formatCurrency*/ ctx[5](monthlyRaised) + "";
	let t46;
	let t47;
	let t48;
	let span1;
	let t49_value = /*formatCurrency*/ ctx[5](monthlyGoal) + "";
	let t49;
	let t50;
	let t51;
	let section3;
	let h22;
	let t52;
	let t53;
	let div19;
	let div14;
	let img1;
	let img1_src_value;
	let t54;
	let div18;
	let p9;
	let t55;
	let t56;
	let p10;
	let t57;
	let t58;
	let ul1;
	let li3;
	let strong0;
	let t59;
	let t60;
	let t61;
	let li4;
	let strong1;
	let t62;
	let t63;
	let t64;
	let p11;
	let t65;
	let t66;
	let p12;
	let t67;
	let t68;
	let div16;
	let div15;
	let t69;
	let div17;
	let span2;
	let t70_value = /*formatCurrency*/ ctx[5](cushionsRaised) + "";
	let t70;
	let t71;
	let t72;
	let span3;
	let t73_value = /*formatCurrency*/ ctx[5](cushionsGoal) + "";
	let t73;
	let t74;
	let t75;
	let section4;
	let h23;
	let t76;
	let t77;
	let div25;
	let div20;
	let img2;
	let img2_src_value;
	let t78;
	let div24;
	let p13;
	let t79;
	let t80;
	let p14;
	let t81;
	let t82;
	let h35;
	let t83;
	let t84;
	let p15;
	let t85;
	let t86;
	let ul2;
	let li5;
	let t87;
	let t88;
	let li6;
	let t89;
	let t90;
	let li7;
	let t91;
	let t92;
	let li8;
	let t93;
	let t94;
	let p16;
	let t95;
	let t96;
	let div22;
	let div21;
	let t97;
	let div23;
	let span4;
	let t98_value = /*formatCurrency*/ ctx[5](libraryRaised) + "";
	let t98;
	let t99;
	let t100;
	let span5;
	let t101_value = /*formatCurrency*/ ctx[5](libraryGoal) + "";
	let t101;
	let t102;
	let t103;
	let section5;
	let h24;
	let t104;
	let t105;
	let p17;
	let t106;
	let t107;
	let div29;
	let div26;
	let h36;
	let t108;
	let t109;
	let p18;
	let t110;
	let t111;
	let form0;
	let input0;
	let t112;
	let input1;
	let t113;
	let input2;
	let t114;
	let button0;
	let t115;
	let t116;
	let div27;
	let h37;
	let t117;
	let t118;
	let p19;
	let t119;
	let t120;
	let form1;
	let input3;
	let t121;
	let input4;
	let t122;
	let input5;
	let t123;
	let button1;
	let t124;
	let t125;
	let div28;
	let h38;
	let t126;
	let t127;
	let p20;
	let t128;
	let t129;
	let form2;
	let input6;
	let t130;
	let input7;
	let t131;
	let input8;
	let t132;
	let button2;
	let t133;
	let t134;
	let div30;
	let h39;
	let t135;
	let t136;
	let p21;
	let t137;
	let t138;
	let section6;
	let h25;
	let t139;
	let t140;
	let p22;
	let t141;
	let t142;
	let button3;
	let t143;
	let t144;
	let p23;
	let t145;
	let a;
	let t146;
	let mounted;
	let dispose;
	let each_value_1 = /*expenses*/ ctx[7];
	let each_blocks_1 = [];

	for (let i = 0; i < each_value_1.length; i += 1) {
		each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
	}

	let each_value = /*expenses*/ ctx[7];
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
	}

	return {
		c() {
			main = element("main");
			div31 = element("div");
			header = element("header");
			h1 = element("h1");
			t0 = text("Support Bab Initiative – Be Part of Something Meaningful");
			t1 = space();
			section0 = element("section");
			div0 = element("div");
			img0 = element("img");
			t2 = space();
			div1 = element("div");
			t3 = space();
			section1 = element("section");
			h20 = element("h2");
			t4 = text("How You Can Help");
			t5 = space();
			ul0 = element("ul");
			li0 = element("li");
			t6 = text("Make a one-time contribution");
			t7 = space();
			li1 = element("li");
			t8 = text("Set up a monthly donation to support our project");
			t9 = space();
			li2 = element("li");
			t10 = text("Provide materials or resources for activities");
			t11 = space();
			p0 = element("p");
			t12 = text("Your support makes a real difference. Together, we can keep Bab Initiative thriving and \n        continue building a stronger, more connected community.");
			t13 = space();
			section2 = element("section");
			h21 = element("h2");
			t14 = text("Keeping Bab Initiative Alive – The Reality Behind the Scenes");
			t15 = space();
			p1 = element("p");
			t16 = text("Bab Initiative exists because of the passion and dedication of its volunteers—but passion \n        alone doesn't pay the bills. Running a community center comes with real, unavoidable \n        expenses:");
			t17 = space();
			div6 = element("div");
			div2 = element("div");
			h30 = element("h3");
			t18 = text("Rent");
			t19 = space();
			p2 = element("p");
			t20 = text("Keeping our doors open means securing a space where everyone can gather, learn, and share.");
			t21 = space();
			div3 = element("div");
			h31 = element("h3");
			t22 = text("Utilities");
			t23 = space();
			p3 = element("p");
			t24 = text("Electricity, water, etc.—basic needs that keep Bab running every day.");
			t25 = space();
			div4 = element("div");
			h32 = element("h3");
			t26 = text("Administration");
			t27 = space();
			p4 = element("p");
			t28 = text("Legal fees, permits, and other behind-the-scenes costs to keep us official and operational.");
			t29 = space();
			div5 = element("div");
			h33 = element("h3");
			t30 = text("Supplies & Maintenance");
			t31 = space();
			p5 = element("p");
			t32 = text("From chairs and pencils, to cleaning products and toilet paper—every detail matters.");
			t33 = space();
			p6 = element("p");
			t34 = text("So far, these expenses have been carried almost entirely by the founders, as Bab Initiative \n        does not yet receive any grants or external financial support. We operate on a simple \n        reality: if we don't cover these costs, Bab cannot continue to exist.");
			t35 = space();
			p7 = element("p");
			t36 = text("This is where you come in. Your support—no matter the amount—helps share the load and \n        ensures that Bab remains a welcoming space for all.");
			t37 = space();
			p8 = element("p");
			t38 = text("Every little bit counts. Let's keep Bab alive, together.");
			t39 = space();
			div13 = element("div");
			h34 = element("h3");
			t40 = text("Monthly Expenses: ");
			t41 = text(t41_value);
			t42 = space();
			div9 = element("div");
			div7 = element("div");

			for (let i = 0; i < each_blocks_1.length; i += 1) {
				each_blocks_1[i].c();
			}

			t43 = space();
			div8 = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t44 = space();
			div11 = element("div");
			div10 = element("div");
			t45 = space();
			div12 = element("div");
			span0 = element("span");
			t46 = text(t46_value);
			t47 = text(" raised");
			t48 = space();
			span1 = element("span");
			t49 = text(t49_value);
			t50 = text(" goal");
			t51 = space();
			section3 = element("section");
			h22 = element("h2");
			t52 = text("Our First Project – More Cushions for Lojong Meditation");
			t53 = space();
			div19 = element("div");
			div14 = element("div");
			img1 = element("img");
			t54 = space();
			div18 = element("div");
			p9 = element("p");
			t55 = text("Our Lojong Meditation sessions have been a great success, bringing people together for \n            moments of peace and mindfulness. But with this success comes a challenge—we need \n            more cushions to accommodate everyone comfortably!");
			t56 = space();
			p10 = element("p");
			t57 = text("To double our capacity, we aim to make 15 large cushions and 10 small ones. We've \n            already received a quotation from a small artisan in Maadi (the same talented hands that \n            crafted our current cushions), and the total cost for this project is 2,000 EGP.");
			t58 = space();
			ul1 = element("ul");
			li3 = element("li");
			strong0 = element("strong");
			t59 = text("Purpose:");
			t60 = text(" Support a local artisan while making meditation accessible to more people.");
			t61 = space();
			li4 = element("li");
			strong1 = element("strong");
			t62 = text("Goal:");
			t63 = text(" Raise the 2,000 EGP by the end of May.");
			t64 = space();
			p11 = element("p");
			t65 = text("If you've enjoyed our meditation sessions or simply believe in the power of creating a peaceful \n            space for the community, this is your chance to contribute!");
			t66 = space();
			p12 = element("p");
			t67 = text("Every contribution brings us closer to making this happen!");
			t68 = space();
			div16 = element("div");
			div15 = element("div");
			t69 = space();
			div17 = element("div");
			span2 = element("span");
			t70 = text(t70_value);
			t71 = text(" raised");
			t72 = space();
			span3 = element("span");
			t73 = text(t73_value);
			t74 = text(" goal");
			t75 = space();
			section4 = element("section");
			h23 = element("h2");
			t76 = text("Bablio – Expanding Our Library!");
			t77 = space();
			div25 = element("div");
			div20 = element("div");
			img2 = element("img");
			t78 = space();
			div24 = element("div");
			p13 = element("p");
			t79 = text("At Bab Initiative, we believe that books open doors to new worlds, ideas, and opportunities. \n            Our Bablio group is dedicated to making reading accessible to all, and we are proud to have \n            over 665 books, in English, French, German, Arabic, Spanish, available for our community!");
			t80 = space();
			p14 = element("p");
			t81 = text("Recently, thanks to generous donations, our collection has grown significantly. But to truly \n            make these books available, we need more storage space!");
			t82 = space();
			h35 = element("h3");
			t83 = text("Our Goal: A Bigger & Better Library");
			t84 = space();
			p15 = element("p");
			t85 = text("Our current shelves were bought second-hand in 2021 for 2,000 EGP. Now, it's time to expand!");
			t86 = space();
			ul2 = element("ul");
			li5 = element("li");
			t87 = text("We plan to add 10 shelves to accommodate more books.");
			t88 = space();
			li6 = element("li");
			t89 = text("We found a great option at IKEA: IVAR Shelf - Pine (matching our current library)");
			t90 = space();
			li7 = element("li");
			t91 = text("Total cost: 750 EGP x 10 = 7,500 EGP");
			t92 = space();
			li8 = element("li");
			t93 = text("Target date: End of May");
			t94 = space();
			p16 = element("p");
			t95 = text("Let's keep Bablio growing and offer even more opportunities for adventure, learning, and inspiration! ✨");
			t96 = space();
			div22 = element("div");
			div21 = element("div");
			t97 = space();
			div23 = element("div");
			span4 = element("span");
			t98 = text(t98_value);
			t99 = text(" raised");
			t100 = space();
			span5 = element("span");
			t101 = text(t101_value);
			t102 = text(" goal");
			t103 = space();
			section5 = element("section");
			h24 = element("h2");
			t104 = text("Make a Donation");
			t105 = space();
			p17 = element("p");
			t106 = text("Your contribution will help keep Bab Initiative alive and thriving.");
			t107 = space();
			div29 = element("div");
			div26 = element("div");
			h36 = element("h3");
			t108 = text("Monthly Operations");
			t109 = space();
			p18 = element("p");
			t110 = text("Help us cover our basic monthly expenses");
			t111 = space();
			form0 = element("form");
			input0 = element("input");
			t112 = space();
			input1 = element("input");
			t113 = space();
			input2 = element("input");
			t114 = space();
			button0 = element("button");
			t115 = text("Donate Now");
			t116 = space();
			div27 = element("div");
			h37 = element("h3");
			t117 = text("Meditation Cushions");
			t118 = space();
			p19 = element("p");
			t119 = text("Support our meditation project");
			t120 = space();
			form1 = element("form");
			input3 = element("input");
			t121 = space();
			input4 = element("input");
			t122 = space();
			input5 = element("input");
			t123 = space();
			button1 = element("button");
			t124 = text("Donate Now");
			t125 = space();
			div28 = element("div");
			h38 = element("h3");
			t126 = text("Library Expansion");
			t127 = space();
			p20 = element("p");
			t128 = text("Help us expand our book collection");
			t129 = space();
			form2 = element("form");
			input6 = element("input");
			t130 = space();
			input7 = element("input");
			t131 = space();
			input8 = element("input");
			t132 = space();
			button2 = element("button");
			t133 = text("Donate Now");
			t134 = space();
			div30 = element("div");
			h39 = element("h3");
			t135 = text("Alternative Ways to Help");
			t136 = space();
			p21 = element("p");
			t137 = text("If you know someone willing to sell or donate second-hand shelves, or if you have materials that could be useful for our activities, please let us know!");
			t138 = space();
			section6 = element("section");
			h25 = element("h2");
			t139 = text("Contact Us");
			t140 = space();
			p22 = element("p");
			t141 = text("Have questions about our fundraising efforts or want to learn more about Bab Initiative?");
			t142 = space();
			button3 = element("button");
			t143 = text("Contact via WhatsApp");
			t144 = space();
			p23 = element("p");
			t145 = text("Or email us at: ");
			a = element("a");
			t146 = text("info@babinitiative.org");
			this.h();
		},
		l(nodes) {
			main = claim_element(nodes, "MAIN", {});
			var main_nodes = children(main);
			div31 = claim_element(main_nodes, "DIV", { class: true });
			var div31_nodes = children(div31);
			header = claim_element(div31_nodes, "HEADER", { class: true });
			var header_nodes = children(header);
			h1 = claim_element(header_nodes, "H1", { class: true });
			var h1_nodes = children(h1);
			t0 = claim_text(h1_nodes, "Support Bab Initiative – Be Part of Something Meaningful");
			h1_nodes.forEach(detach);
			header_nodes.forEach(detach);
			t1 = claim_space(div31_nodes);
			section0 = claim_element(div31_nodes, "SECTION", { class: true });
			var section0_nodes = children(section0);
			div0 = claim_element(section0_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);
			img0 = claim_element(div0_nodes, "IMG", { src: true, alt: true, class: true });
			div0_nodes.forEach(detach);
			t2 = claim_space(section0_nodes);
			div1 = claim_element(section0_nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			div1_nodes.forEach(detach);
			section0_nodes.forEach(detach);
			t3 = claim_space(div31_nodes);
			section1 = claim_element(div31_nodes, "SECTION", { class: true });
			var section1_nodes = children(section1);
			h20 = claim_element(section1_nodes, "H2", { class: true });
			var h20_nodes = children(h20);
			t4 = claim_text(h20_nodes, "How You Can Help");
			h20_nodes.forEach(detach);
			t5 = claim_space(section1_nodes);
			ul0 = claim_element(section1_nodes, "UL", { class: true });
			var ul0_nodes = children(ul0);
			li0 = claim_element(ul0_nodes, "LI", { class: true });
			var li0_nodes = children(li0);
			t6 = claim_text(li0_nodes, "Make a one-time contribution");
			li0_nodes.forEach(detach);
			t7 = claim_space(ul0_nodes);
			li1 = claim_element(ul0_nodes, "LI", { class: true });
			var li1_nodes = children(li1);
			t8 = claim_text(li1_nodes, "Set up a monthly donation to support our project");
			li1_nodes.forEach(detach);
			t9 = claim_space(ul0_nodes);
			li2 = claim_element(ul0_nodes, "LI", { class: true });
			var li2_nodes = children(li2);
			t10 = claim_text(li2_nodes, "Provide materials or resources for activities");
			li2_nodes.forEach(detach);
			ul0_nodes.forEach(detach);
			t11 = claim_space(section1_nodes);
			p0 = claim_element(section1_nodes, "P", {});
			var p0_nodes = children(p0);
			t12 = claim_text(p0_nodes, "Your support makes a real difference. Together, we can keep Bab Initiative thriving and \n        continue building a stronger, more connected community.");
			p0_nodes.forEach(detach);
			section1_nodes.forEach(detach);
			t13 = claim_space(div31_nodes);
			section2 = claim_element(div31_nodes, "SECTION", { class: true });
			var section2_nodes = children(section2);
			h21 = claim_element(section2_nodes, "H2", { class: true });
			var h21_nodes = children(h21);
			t14 = claim_text(h21_nodes, "Keeping Bab Initiative Alive – The Reality Behind the Scenes");
			h21_nodes.forEach(detach);
			t15 = claim_space(section2_nodes);
			p1 = claim_element(section2_nodes, "P", {});
			var p1_nodes = children(p1);
			t16 = claim_text(p1_nodes, "Bab Initiative exists because of the passion and dedication of its volunteers—but passion \n        alone doesn't pay the bills. Running a community center comes with real, unavoidable \n        expenses:");
			p1_nodes.forEach(detach);
			t17 = claim_space(section2_nodes);
			div6 = claim_element(section2_nodes, "DIV", { class: true });
			var div6_nodes = children(div6);
			div2 = claim_element(div6_nodes, "DIV", { class: true });
			var div2_nodes = children(div2);
			h30 = claim_element(div2_nodes, "H3", { class: true });
			var h30_nodes = children(h30);
			t18 = claim_text(h30_nodes, "Rent");
			h30_nodes.forEach(detach);
			t19 = claim_space(div2_nodes);
			p2 = claim_element(div2_nodes, "P", {});
			var p2_nodes = children(p2);
			t20 = claim_text(p2_nodes, "Keeping our doors open means securing a space where everyone can gather, learn, and share.");
			p2_nodes.forEach(detach);
			div2_nodes.forEach(detach);
			t21 = claim_space(div6_nodes);
			div3 = claim_element(div6_nodes, "DIV", { class: true });
			var div3_nodes = children(div3);
			h31 = claim_element(div3_nodes, "H3", { class: true });
			var h31_nodes = children(h31);
			t22 = claim_text(h31_nodes, "Utilities");
			h31_nodes.forEach(detach);
			t23 = claim_space(div3_nodes);
			p3 = claim_element(div3_nodes, "P", {});
			var p3_nodes = children(p3);
			t24 = claim_text(p3_nodes, "Electricity, water, etc.—basic needs that keep Bab running every day.");
			p3_nodes.forEach(detach);
			div3_nodes.forEach(detach);
			t25 = claim_space(div6_nodes);
			div4 = claim_element(div6_nodes, "DIV", { class: true });
			var div4_nodes = children(div4);
			h32 = claim_element(div4_nodes, "H3", { class: true });
			var h32_nodes = children(h32);
			t26 = claim_text(h32_nodes, "Administration");
			h32_nodes.forEach(detach);
			t27 = claim_space(div4_nodes);
			p4 = claim_element(div4_nodes, "P", {});
			var p4_nodes = children(p4);
			t28 = claim_text(p4_nodes, "Legal fees, permits, and other behind-the-scenes costs to keep us official and operational.");
			p4_nodes.forEach(detach);
			div4_nodes.forEach(detach);
			t29 = claim_space(div6_nodes);
			div5 = claim_element(div6_nodes, "DIV", { class: true });
			var div5_nodes = children(div5);
			h33 = claim_element(div5_nodes, "H3", { class: true });
			var h33_nodes = children(h33);
			t30 = claim_text(h33_nodes, "Supplies & Maintenance");
			h33_nodes.forEach(detach);
			t31 = claim_space(div5_nodes);
			p5 = claim_element(div5_nodes, "P", {});
			var p5_nodes = children(p5);
			t32 = claim_text(p5_nodes, "From chairs and pencils, to cleaning products and toilet paper—every detail matters.");
			p5_nodes.forEach(detach);
			div5_nodes.forEach(detach);
			div6_nodes.forEach(detach);
			t33 = claim_space(section2_nodes);
			p6 = claim_element(section2_nodes, "P", {});
			var p6_nodes = children(p6);
			t34 = claim_text(p6_nodes, "So far, these expenses have been carried almost entirely by the founders, as Bab Initiative \n        does not yet receive any grants or external financial support. We operate on a simple \n        reality: if we don't cover these costs, Bab cannot continue to exist.");
			p6_nodes.forEach(detach);
			t35 = claim_space(section2_nodes);
			p7 = claim_element(section2_nodes, "P", {});
			var p7_nodes = children(p7);
			t36 = claim_text(p7_nodes, "This is where you come in. Your support—no matter the amount—helps share the load and \n        ensures that Bab remains a welcoming space for all.");
			p7_nodes.forEach(detach);
			t37 = claim_space(section2_nodes);
			p8 = claim_element(section2_nodes, "P", { class: true });
			var p8_nodes = children(p8);
			t38 = claim_text(p8_nodes, "Every little bit counts. Let's keep Bab alive, together.");
			p8_nodes.forEach(detach);
			t39 = claim_space(section2_nodes);
			div13 = claim_element(section2_nodes, "DIV", { class: true });
			var div13_nodes = children(div13);
			h34 = claim_element(div13_nodes, "H3", { class: true });
			var h34_nodes = children(h34);
			t40 = claim_text(h34_nodes, "Monthly Expenses: ");
			t41 = claim_text(h34_nodes, t41_value);
			h34_nodes.forEach(detach);
			t42 = claim_space(div13_nodes);
			div9 = claim_element(div13_nodes, "DIV", { class: true });
			var div9_nodes = children(div9);
			div7 = claim_element(div9_nodes, "DIV", { class: true });
			var div7_nodes = children(div7);

			for (let i = 0; i < each_blocks_1.length; i += 1) {
				each_blocks_1[i].l(div7_nodes);
			}

			div7_nodes.forEach(detach);
			t43 = claim_space(div9_nodes);
			div8 = claim_element(div9_nodes, "DIV", { class: true });
			var div8_nodes = children(div8);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].l(div8_nodes);
			}

			div8_nodes.forEach(detach);
			div9_nodes.forEach(detach);
			t44 = claim_space(div13_nodes);
			div11 = claim_element(div13_nodes, "DIV", { class: true });
			var div11_nodes = children(div11);
			div10 = claim_element(div11_nodes, "DIV", { class: true, style: true });
			children(div10).forEach(detach);
			div11_nodes.forEach(detach);
			t45 = claim_space(div13_nodes);
			div12 = claim_element(div13_nodes, "DIV", { class: true });
			var div12_nodes = children(div12);
			span0 = claim_element(div12_nodes, "SPAN", {});
			var span0_nodes = children(span0);
			t46 = claim_text(span0_nodes, t46_value);
			t47 = claim_text(span0_nodes, " raised");
			span0_nodes.forEach(detach);
			t48 = claim_space(div12_nodes);
			span1 = claim_element(div12_nodes, "SPAN", {});
			var span1_nodes = children(span1);
			t49 = claim_text(span1_nodes, t49_value);
			t50 = claim_text(span1_nodes, " goal");
			span1_nodes.forEach(detach);
			div12_nodes.forEach(detach);
			div13_nodes.forEach(detach);
			section2_nodes.forEach(detach);
			t51 = claim_space(div31_nodes);
			section3 = claim_element(div31_nodes, "SECTION", { class: true });
			var section3_nodes = children(section3);
			h22 = claim_element(section3_nodes, "H2", { class: true });
			var h22_nodes = children(h22);
			t52 = claim_text(h22_nodes, "Our First Project – More Cushions for Lojong Meditation");
			h22_nodes.forEach(detach);
			t53 = claim_space(section3_nodes);
			div19 = claim_element(section3_nodes, "DIV", { class: true });
			var div19_nodes = children(div19);
			div14 = claim_element(div19_nodes, "DIV", { class: true });
			var div14_nodes = children(div14);
			img1 = claim_element(div14_nodes, "IMG", { src: true, alt: true, class: true });
			div14_nodes.forEach(detach);
			t54 = claim_space(div19_nodes);
			div18 = claim_element(div19_nodes, "DIV", { class: true });
			var div18_nodes = children(div18);
			p9 = claim_element(div18_nodes, "P", {});
			var p9_nodes = children(p9);
			t55 = claim_text(p9_nodes, "Our Lojong Meditation sessions have been a great success, bringing people together for \n            moments of peace and mindfulness. But with this success comes a challenge—we need \n            more cushions to accommodate everyone comfortably!");
			p9_nodes.forEach(detach);
			t56 = claim_space(div18_nodes);
			p10 = claim_element(div18_nodes, "P", {});
			var p10_nodes = children(p10);
			t57 = claim_text(p10_nodes, "To double our capacity, we aim to make 15 large cushions and 10 small ones. We've \n            already received a quotation from a small artisan in Maadi (the same talented hands that \n            crafted our current cushions), and the total cost for this project is 2,000 EGP.");
			p10_nodes.forEach(detach);
			t58 = claim_space(div18_nodes);
			ul1 = claim_element(div18_nodes, "UL", { class: true });
			var ul1_nodes = children(ul1);
			li3 = claim_element(ul1_nodes, "LI", {});
			var li3_nodes = children(li3);
			strong0 = claim_element(li3_nodes, "STRONG", {});
			var strong0_nodes = children(strong0);
			t59 = claim_text(strong0_nodes, "Purpose:");
			strong0_nodes.forEach(detach);
			t60 = claim_text(li3_nodes, " Support a local artisan while making meditation accessible to more people.");
			li3_nodes.forEach(detach);
			t61 = claim_space(ul1_nodes);
			li4 = claim_element(ul1_nodes, "LI", {});
			var li4_nodes = children(li4);
			strong1 = claim_element(li4_nodes, "STRONG", {});
			var strong1_nodes = children(strong1);
			t62 = claim_text(strong1_nodes, "Goal:");
			strong1_nodes.forEach(detach);
			t63 = claim_text(li4_nodes, " Raise the 2,000 EGP by the end of May.");
			li4_nodes.forEach(detach);
			ul1_nodes.forEach(detach);
			t64 = claim_space(div18_nodes);
			p11 = claim_element(div18_nodes, "P", {});
			var p11_nodes = children(p11);
			t65 = claim_text(p11_nodes, "If you've enjoyed our meditation sessions or simply believe in the power of creating a peaceful \n            space for the community, this is your chance to contribute!");
			p11_nodes.forEach(detach);
			t66 = claim_space(div18_nodes);
			p12 = claim_element(div18_nodes, "P", { class: true });
			var p12_nodes = children(p12);
			t67 = claim_text(p12_nodes, "Every contribution brings us closer to making this happen!");
			p12_nodes.forEach(detach);
			t68 = claim_space(div18_nodes);
			div16 = claim_element(div18_nodes, "DIV", { class: true });
			var div16_nodes = children(div16);
			div15 = claim_element(div16_nodes, "DIV", { class: true, style: true });
			children(div15).forEach(detach);
			div16_nodes.forEach(detach);
			t69 = claim_space(div18_nodes);
			div17 = claim_element(div18_nodes, "DIV", { class: true });
			var div17_nodes = children(div17);
			span2 = claim_element(div17_nodes, "SPAN", {});
			var span2_nodes = children(span2);
			t70 = claim_text(span2_nodes, t70_value);
			t71 = claim_text(span2_nodes, " raised");
			span2_nodes.forEach(detach);
			t72 = claim_space(div17_nodes);
			span3 = claim_element(div17_nodes, "SPAN", {});
			var span3_nodes = children(span3);
			t73 = claim_text(span3_nodes, t73_value);
			t74 = claim_text(span3_nodes, " goal");
			span3_nodes.forEach(detach);
			div17_nodes.forEach(detach);
			div18_nodes.forEach(detach);
			div19_nodes.forEach(detach);
			section3_nodes.forEach(detach);
			t75 = claim_space(div31_nodes);
			section4 = claim_element(div31_nodes, "SECTION", { class: true });
			var section4_nodes = children(section4);
			h23 = claim_element(section4_nodes, "H2", { class: true });
			var h23_nodes = children(h23);
			t76 = claim_text(h23_nodes, "Bablio – Expanding Our Library!");
			h23_nodes.forEach(detach);
			t77 = claim_space(section4_nodes);
			div25 = claim_element(section4_nodes, "DIV", { class: true });
			var div25_nodes = children(div25);
			div20 = claim_element(div25_nodes, "DIV", { class: true });
			var div20_nodes = children(div20);
			img2 = claim_element(div20_nodes, "IMG", { src: true, alt: true, class: true });
			div20_nodes.forEach(detach);
			t78 = claim_space(div25_nodes);
			div24 = claim_element(div25_nodes, "DIV", { class: true });
			var div24_nodes = children(div24);
			p13 = claim_element(div24_nodes, "P", {});
			var p13_nodes = children(p13);
			t79 = claim_text(p13_nodes, "At Bab Initiative, we believe that books open doors to new worlds, ideas, and opportunities. \n            Our Bablio group is dedicated to making reading accessible to all, and we are proud to have \n            over 665 books, in English, French, German, Arabic, Spanish, available for our community!");
			p13_nodes.forEach(detach);
			t80 = claim_space(div24_nodes);
			p14 = claim_element(div24_nodes, "P", {});
			var p14_nodes = children(p14);
			t81 = claim_text(p14_nodes, "Recently, thanks to generous donations, our collection has grown significantly. But to truly \n            make these books available, we need more storage space!");
			p14_nodes.forEach(detach);
			t82 = claim_space(div24_nodes);
			h35 = claim_element(div24_nodes, "H3", { class: true });
			var h35_nodes = children(h35);
			t83 = claim_text(h35_nodes, "Our Goal: A Bigger & Better Library");
			h35_nodes.forEach(detach);
			t84 = claim_space(div24_nodes);
			p15 = claim_element(div24_nodes, "P", {});
			var p15_nodes = children(p15);
			t85 = claim_text(p15_nodes, "Our current shelves were bought second-hand in 2021 for 2,000 EGP. Now, it's time to expand!");
			p15_nodes.forEach(detach);
			t86 = claim_space(div24_nodes);
			ul2 = claim_element(div24_nodes, "UL", { class: true });
			var ul2_nodes = children(ul2);
			li5 = claim_element(ul2_nodes, "LI", {});
			var li5_nodes = children(li5);
			t87 = claim_text(li5_nodes, "We plan to add 10 shelves to accommodate more books.");
			li5_nodes.forEach(detach);
			t88 = claim_space(ul2_nodes);
			li6 = claim_element(ul2_nodes, "LI", {});
			var li6_nodes = children(li6);
			t89 = claim_text(li6_nodes, "We found a great option at IKEA: IVAR Shelf - Pine (matching our current library)");
			li6_nodes.forEach(detach);
			t90 = claim_space(ul2_nodes);
			li7 = claim_element(ul2_nodes, "LI", {});
			var li7_nodes = children(li7);
			t91 = claim_text(li7_nodes, "Total cost: 750 EGP x 10 = 7,500 EGP");
			li7_nodes.forEach(detach);
			t92 = claim_space(ul2_nodes);
			li8 = claim_element(ul2_nodes, "LI", {});
			var li8_nodes = children(li8);
			t93 = claim_text(li8_nodes, "Target date: End of May");
			li8_nodes.forEach(detach);
			ul2_nodes.forEach(detach);
			t94 = claim_space(div24_nodes);
			p16 = claim_element(div24_nodes, "P", { class: true });
			var p16_nodes = children(p16);
			t95 = claim_text(p16_nodes, "Let's keep Bablio growing and offer even more opportunities for adventure, learning, and inspiration! ✨");
			p16_nodes.forEach(detach);
			t96 = claim_space(div24_nodes);
			div22 = claim_element(div24_nodes, "DIV", { class: true });
			var div22_nodes = children(div22);
			div21 = claim_element(div22_nodes, "DIV", { class: true, style: true });
			children(div21).forEach(detach);
			div22_nodes.forEach(detach);
			t97 = claim_space(div24_nodes);
			div23 = claim_element(div24_nodes, "DIV", { class: true });
			var div23_nodes = children(div23);
			span4 = claim_element(div23_nodes, "SPAN", {});
			var span4_nodes = children(span4);
			t98 = claim_text(span4_nodes, t98_value);
			t99 = claim_text(span4_nodes, " raised");
			span4_nodes.forEach(detach);
			t100 = claim_space(div23_nodes);
			span5 = claim_element(div23_nodes, "SPAN", {});
			var span5_nodes = children(span5);
			t101 = claim_text(span5_nodes, t101_value);
			t102 = claim_text(span5_nodes, " goal");
			span5_nodes.forEach(detach);
			div23_nodes.forEach(detach);
			div24_nodes.forEach(detach);
			div25_nodes.forEach(detach);
			section4_nodes.forEach(detach);
			t103 = claim_space(div31_nodes);
			section5 = claim_element(div31_nodes, "SECTION", { class: true });
			var section5_nodes = children(section5);
			h24 = claim_element(section5_nodes, "H2", { class: true });
			var h24_nodes = children(h24);
			t104 = claim_text(h24_nodes, "Make a Donation");
			h24_nodes.forEach(detach);
			t105 = claim_space(section5_nodes);
			p17 = claim_element(section5_nodes, "P", {});
			var p17_nodes = children(p17);
			t106 = claim_text(p17_nodes, "Your contribution will help keep Bab Initiative alive and thriving.");
			p17_nodes.forEach(detach);
			t107 = claim_space(section5_nodes);
			div29 = claim_element(section5_nodes, "DIV", { class: true });
			var div29_nodes = children(div29);
			div26 = claim_element(div29_nodes, "DIV", { class: true });
			var div26_nodes = children(div26);
			h36 = claim_element(div26_nodes, "H3", { class: true });
			var h36_nodes = children(h36);
			t108 = claim_text(h36_nodes, "Monthly Operations");
			h36_nodes.forEach(detach);
			t109 = claim_space(div26_nodes);
			p18 = claim_element(div26_nodes, "P", {});
			var p18_nodes = children(p18);
			t110 = claim_text(p18_nodes, "Help us cover our basic monthly expenses");
			p18_nodes.forEach(detach);
			t111 = claim_space(div26_nodes);
			form0 = claim_element(div26_nodes, "FORM", { action: true, method: true, target: true });
			var form0_nodes = children(form0);
			input0 = claim_element(form0_nodes, "INPUT", { type: true, name: true });
			t112 = claim_space(form0_nodes);
			input1 = claim_element(form0_nodes, "INPUT", { type: true, name: true });
			t113 = claim_space(form0_nodes);
			input2 = claim_element(form0_nodes, "INPUT", { type: true, name: true });
			t114 = claim_space(form0_nodes);
			button0 = claim_element(form0_nodes, "BUTTON", { type: true, class: true });
			var button0_nodes = children(button0);
			t115 = claim_text(button0_nodes, "Donate Now");
			button0_nodes.forEach(detach);
			form0_nodes.forEach(detach);
			div26_nodes.forEach(detach);
			t116 = claim_space(div29_nodes);
			div27 = claim_element(div29_nodes, "DIV", { class: true });
			var div27_nodes = children(div27);
			h37 = claim_element(div27_nodes, "H3", { class: true });
			var h37_nodes = children(h37);
			t117 = claim_text(h37_nodes, "Meditation Cushions");
			h37_nodes.forEach(detach);
			t118 = claim_space(div27_nodes);
			p19 = claim_element(div27_nodes, "P", {});
			var p19_nodes = children(p19);
			t119 = claim_text(p19_nodes, "Support our meditation project");
			p19_nodes.forEach(detach);
			t120 = claim_space(div27_nodes);
			form1 = claim_element(div27_nodes, "FORM", { action: true, method: true, target: true });
			var form1_nodes = children(form1);
			input3 = claim_element(form1_nodes, "INPUT", { type: true, name: true });
			t121 = claim_space(form1_nodes);
			input4 = claim_element(form1_nodes, "INPUT", { type: true, name: true });
			t122 = claim_space(form1_nodes);
			input5 = claim_element(form1_nodes, "INPUT", { type: true, name: true });
			t123 = claim_space(form1_nodes);
			button1 = claim_element(form1_nodes, "BUTTON", { type: true, class: true });
			var button1_nodes = children(button1);
			t124 = claim_text(button1_nodes, "Donate Now");
			button1_nodes.forEach(detach);
			form1_nodes.forEach(detach);
			div27_nodes.forEach(detach);
			t125 = claim_space(div29_nodes);
			div28 = claim_element(div29_nodes, "DIV", { class: true });
			var div28_nodes = children(div28);
			h38 = claim_element(div28_nodes, "H3", { class: true });
			var h38_nodes = children(h38);
			t126 = claim_text(h38_nodes, "Library Expansion");
			h38_nodes.forEach(detach);
			t127 = claim_space(div28_nodes);
			p20 = claim_element(div28_nodes, "P", {});
			var p20_nodes = children(p20);
			t128 = claim_text(p20_nodes, "Help us expand our book collection");
			p20_nodes.forEach(detach);
			t129 = claim_space(div28_nodes);
			form2 = claim_element(div28_nodes, "FORM", { action: true, method: true, target: true });
			var form2_nodes = children(form2);
			input6 = claim_element(form2_nodes, "INPUT", { type: true, name: true });
			t130 = claim_space(form2_nodes);
			input7 = claim_element(form2_nodes, "INPUT", { type: true, name: true });
			t131 = claim_space(form2_nodes);
			input8 = claim_element(form2_nodes, "INPUT", { type: true, name: true });
			t132 = claim_space(form2_nodes);
			button2 = claim_element(form2_nodes, "BUTTON", { type: true, class: true });
			var button2_nodes = children(button2);
			t133 = claim_text(button2_nodes, "Donate Now");
			button2_nodes.forEach(detach);
			form2_nodes.forEach(detach);
			div28_nodes.forEach(detach);
			div29_nodes.forEach(detach);
			t134 = claim_space(section5_nodes);
			div30 = claim_element(section5_nodes, "DIV", { class: true });
			var div30_nodes = children(div30);
			h39 = claim_element(div30_nodes, "H3", { class: true });
			var h39_nodes = children(h39);
			t135 = claim_text(h39_nodes, "Alternative Ways to Help");
			h39_nodes.forEach(detach);
			t136 = claim_space(div30_nodes);
			p21 = claim_element(div30_nodes, "P", {});
			var p21_nodes = children(p21);
			t137 = claim_text(p21_nodes, "If you know someone willing to sell or donate second-hand shelves, or if you have materials that could be useful for our activities, please let us know!");
			p21_nodes.forEach(detach);
			div30_nodes.forEach(detach);
			section5_nodes.forEach(detach);
			t138 = claim_space(div31_nodes);
			section6 = claim_element(div31_nodes, "SECTION", { class: true });
			var section6_nodes = children(section6);
			h25 = claim_element(section6_nodes, "H2", { class: true });
			var h25_nodes = children(h25);
			t139 = claim_text(h25_nodes, "Contact Us");
			h25_nodes.forEach(detach);
			t140 = claim_space(section6_nodes);
			p22 = claim_element(section6_nodes, "P", {});
			var p22_nodes = children(p22);
			t141 = claim_text(p22_nodes, "Have questions about our fundraising efforts or want to learn more about Bab Initiative?");
			p22_nodes.forEach(detach);
			t142 = claim_space(section6_nodes);
			button3 = claim_element(section6_nodes, "BUTTON", { class: true });
			var button3_nodes = children(button3);
			t143 = claim_text(button3_nodes, "Contact via WhatsApp");
			button3_nodes.forEach(detach);
			t144 = claim_space(section6_nodes);
			p23 = claim_element(section6_nodes, "P", { class: true });
			var p23_nodes = children(p23);
			t145 = claim_text(p23_nodes, "Or email us at: ");
			a = claim_element(p23_nodes, "A", { href: true, class: true });
			var a_nodes = children(a);
			t146 = claim_text(a_nodes, "info@babinitiative.org");
			a_nodes.forEach(detach);
			p23_nodes.forEach(detach);
			section6_nodes.forEach(detach);
			div31_nodes.forEach(detach);
			main_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(h1, "class", "svelte-spn9g9");
			attr(header, "class", "svelte-spn9g9");
			if (!src_url_equal(img0.src, img0_src_value = /*image*/ ctx[0].url)) attr(img0, "src", img0_src_value);
			attr(img0, "alt", img0_alt_value = /*image*/ ctx[0].alt);
			attr(img0, "class", "main-image svelte-spn9g9");
			attr(div0, "class", "image-container svelte-spn9g9");
			attr(div1, "class", "content svelte-spn9g9");
			attr(section0, "class", "intro-section svelte-spn9g9");
			attr(h20, "class", "svelte-spn9g9");
			attr(li0, "class", "svelte-spn9g9");
			attr(li1, "class", "svelte-spn9g9");
			attr(li2, "class", "svelte-spn9g9");
			attr(ul0, "class", "svelte-spn9g9");
			attr(section1, "class", "help-section svelte-spn9g9");
			attr(h21, "class", "svelte-spn9g9");
			attr(h30, "class", "svelte-spn9g9");
			attr(div2, "class", "expense-item svelte-spn9g9");
			attr(h31, "class", "svelte-spn9g9");
			attr(div3, "class", "expense-item svelte-spn9g9");
			attr(h32, "class", "svelte-spn9g9");
			attr(div4, "class", "expense-item svelte-spn9g9");
			attr(h33, "class", "svelte-spn9g9");
			attr(div5, "class", "expense-item svelte-spn9g9");
			attr(div6, "class", "expenses-grid svelte-spn9g9");
			attr(p8, "class", "highlight svelte-spn9g9");
			attr(h34, "class", "svelte-spn9g9");
			attr(div7, "class", "pie-chart svelte-spn9g9");
			attr(div8, "class", "chart-legend svelte-spn9g9");
			attr(div9, "class", "chart-container svelte-spn9g9");
			attr(div10, "class", "progress-bar svelte-spn9g9");
			set_style(div10, "width", /*monthlyPercentage*/ ctx[2] + "%");
			attr(div11, "class", "progress-container svelte-spn9g9");
			attr(div12, "class", "progress-stats svelte-spn9g9");
			attr(div13, "class", "monthly-expenses svelte-spn9g9");
			attr(section2, "class", "expenses-section svelte-spn9g9");
			attr(h22, "class", "svelte-spn9g9");
			if (!src_url_equal(img1.src, img1_src_value = "/placeholder.svg?height=300&width=400")) attr(img1, "src", img1_src_value);
			attr(img1, "alt", "Current meditation cushions");
			attr(img1, "class", "svelte-spn9g9");
			attr(div14, "class", "project-image svelte-spn9g9");
			attr(ul1, "class", "svelte-spn9g9");
			attr(p12, "class", "highlight svelte-spn9g9");
			attr(div15, "class", "progress-bar svelte-spn9g9");
			set_style(div15, "width", /*cushionsPercentage*/ ctx[3] + "%");
			attr(div16, "class", "progress-container svelte-spn9g9");
			attr(div17, "class", "progress-stats svelte-spn9g9");
			attr(div18, "class", "project-details svelte-spn9g9");
			attr(div19, "class", "project-content svelte-spn9g9");
			attr(section3, "class", "project-section svelte-spn9g9");
			attr(h23, "class", "svelte-spn9g9");
			if (!src_url_equal(img2.src, img2_src_value = "/placeholder.svg?height=300&width=400")) attr(img2, "src", img2_src_value);
			attr(img2, "alt", "Current library shelves");
			attr(img2, "class", "svelte-spn9g9");
			attr(div20, "class", "project-image svelte-spn9g9");
			attr(h35, "class", "svelte-spn9g9");
			attr(ul2, "class", "svelte-spn9g9");
			attr(p16, "class", "highlight svelte-spn9g9");
			attr(div21, "class", "progress-bar svelte-spn9g9");
			set_style(div21, "width", /*libraryPercentage*/ ctx[4] + "%");
			attr(div22, "class", "progress-container svelte-spn9g9");
			attr(div23, "class", "progress-stats svelte-spn9g9");
			attr(div24, "class", "project-details svelte-spn9g9");
			attr(div25, "class", "project-content svelte-spn9g9");
			attr(section4, "class", "project-section svelte-spn9g9");
			attr(h24, "class", "svelte-spn9g9");
			attr(h36, "class", "svelte-spn9g9");
			attr(input0, "type", "hidden");
			attr(input0, "name", "business");
			input0.value = "donations@babinitiative.org";
			attr(input1, "type", "hidden");
			attr(input1, "name", "item_name");
			input1.value = "Bab Initiative Monthly Support";
			attr(input2, "type", "hidden");
			attr(input2, "name", "currency_code");
			input2.value = "EGP";
			attr(button0, "type", "submit");
			attr(button0, "class", "donate-button svelte-spn9g9");
			attr(form0, "action", "https://www.paypal.com/donate");
			attr(form0, "method", "post");
			attr(form0, "target", "_blank");
			attr(div26, "class", "donation-option svelte-spn9g9");
			attr(h37, "class", "svelte-spn9g9");
			attr(input3, "type", "hidden");
			attr(input3, "name", "business");
			input3.value = "donations@babinitiative.org";
			attr(input4, "type", "hidden");
			attr(input4, "name", "item_name");
			input4.value = "Bab Initiative Meditation Cushions";
			attr(input5, "type", "hidden");
			attr(input5, "name", "currency_code");
			input5.value = "EGP";
			attr(button1, "type", "submit");
			attr(button1, "class", "donate-button svelte-spn9g9");
			attr(form1, "action", "https://www.paypal.com/donate");
			attr(form1, "method", "post");
			attr(form1, "target", "_blank");
			attr(div27, "class", "donation-option svelte-spn9g9");
			attr(h38, "class", "svelte-spn9g9");
			attr(input6, "type", "hidden");
			attr(input6, "name", "business");
			input6.value = "donations@babinitiative.org";
			attr(input7, "type", "hidden");
			attr(input7, "name", "item_name");
			input7.value = "Bab Initiative Library Expansion";
			attr(input8, "type", "hidden");
			attr(input8, "name", "currency_code");
			input8.value = "EGP";
			attr(button2, "type", "submit");
			attr(button2, "class", "donate-button svelte-spn9g9");
			attr(form2, "action", "https://www.paypal.com/donate");
			attr(form2, "method", "post");
			attr(form2, "target", "_blank");
			attr(div28, "class", "donation-option svelte-spn9g9");
			attr(div29, "class", "donation-options svelte-spn9g9");
			attr(h39, "class", "svelte-spn9g9");
			attr(div30, "class", "alternative-help svelte-spn9g9");
			attr(section5, "class", "donation-section svelte-spn9g9");
			attr(h25, "class", "svelte-spn9g9");
			attr(button3, "class", "whatsapp-button svelte-spn9g9");
			attr(a, "href", "mailto:info@babinitiative.org");
			attr(a, "class", "svelte-spn9g9");
			attr(p23, "class", "email svelte-spn9g9");
			attr(section6, "class", "contact-section svelte-spn9g9");
			attr(div31, "class", "container svelte-spn9g9");
		},
		m(target, anchor) {
			insert_hydration(target, main, anchor);
			append_hydration(main, div31);
			append_hydration(div31, header);
			append_hydration(header, h1);
			append_hydration(h1, t0);
			append_hydration(div31, t1);
			append_hydration(div31, section0);
			append_hydration(section0, div0);
			append_hydration(div0, img0);
			append_hydration(section0, t2);
			append_hydration(section0, div1);
			div1.innerHTML = raw_value;
			append_hydration(div31, t3);
			append_hydration(div31, section1);
			append_hydration(section1, h20);
			append_hydration(h20, t4);
			append_hydration(section1, t5);
			append_hydration(section1, ul0);
			append_hydration(ul0, li0);
			append_hydration(li0, t6);
			append_hydration(ul0, t7);
			append_hydration(ul0, li1);
			append_hydration(li1, t8);
			append_hydration(ul0, t9);
			append_hydration(ul0, li2);
			append_hydration(li2, t10);
			append_hydration(section1, t11);
			append_hydration(section1, p0);
			append_hydration(p0, t12);
			append_hydration(div31, t13);
			append_hydration(div31, section2);
			append_hydration(section2, h21);
			append_hydration(h21, t14);
			append_hydration(section2, t15);
			append_hydration(section2, p1);
			append_hydration(p1, t16);
			append_hydration(section2, t17);
			append_hydration(section2, div6);
			append_hydration(div6, div2);
			append_hydration(div2, h30);
			append_hydration(h30, t18);
			append_hydration(div2, t19);
			append_hydration(div2, p2);
			append_hydration(p2, t20);
			append_hydration(div6, t21);
			append_hydration(div6, div3);
			append_hydration(div3, h31);
			append_hydration(h31, t22);
			append_hydration(div3, t23);
			append_hydration(div3, p3);
			append_hydration(p3, t24);
			append_hydration(div6, t25);
			append_hydration(div6, div4);
			append_hydration(div4, h32);
			append_hydration(h32, t26);
			append_hydration(div4, t27);
			append_hydration(div4, p4);
			append_hydration(p4, t28);
			append_hydration(div6, t29);
			append_hydration(div6, div5);
			append_hydration(div5, h33);
			append_hydration(h33, t30);
			append_hydration(div5, t31);
			append_hydration(div5, p5);
			append_hydration(p5, t32);
			append_hydration(section2, t33);
			append_hydration(section2, p6);
			append_hydration(p6, t34);
			append_hydration(section2, t35);
			append_hydration(section2, p7);
			append_hydration(p7, t36);
			append_hydration(section2, t37);
			append_hydration(section2, p8);
			append_hydration(p8, t38);
			append_hydration(section2, t39);
			append_hydration(section2, div13);
			append_hydration(div13, h34);
			append_hydration(h34, t40);
			append_hydration(h34, t41);
			append_hydration(div13, t42);
			append_hydration(div13, div9);
			append_hydration(div9, div7);

			for (let i = 0; i < each_blocks_1.length; i += 1) {
				if (each_blocks_1[i]) {
					each_blocks_1[i].m(div7, null);
				}
			}

			append_hydration(div9, t43);
			append_hydration(div9, div8);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(div8, null);
				}
			}

			append_hydration(div13, t44);
			append_hydration(div13, div11);
			append_hydration(div11, div10);
			append_hydration(div13, t45);
			append_hydration(div13, div12);
			append_hydration(div12, span0);
			append_hydration(span0, t46);
			append_hydration(span0, t47);
			append_hydration(div12, t48);
			append_hydration(div12, span1);
			append_hydration(span1, t49);
			append_hydration(span1, t50);
			append_hydration(div31, t51);
			append_hydration(div31, section3);
			append_hydration(section3, h22);
			append_hydration(h22, t52);
			append_hydration(section3, t53);
			append_hydration(section3, div19);
			append_hydration(div19, div14);
			append_hydration(div14, img1);
			append_hydration(div19, t54);
			append_hydration(div19, div18);
			append_hydration(div18, p9);
			append_hydration(p9, t55);
			append_hydration(div18, t56);
			append_hydration(div18, p10);
			append_hydration(p10, t57);
			append_hydration(div18, t58);
			append_hydration(div18, ul1);
			append_hydration(ul1, li3);
			append_hydration(li3, strong0);
			append_hydration(strong0, t59);
			append_hydration(li3, t60);
			append_hydration(ul1, t61);
			append_hydration(ul1, li4);
			append_hydration(li4, strong1);
			append_hydration(strong1, t62);
			append_hydration(li4, t63);
			append_hydration(div18, t64);
			append_hydration(div18, p11);
			append_hydration(p11, t65);
			append_hydration(div18, t66);
			append_hydration(div18, p12);
			append_hydration(p12, t67);
			append_hydration(div18, t68);
			append_hydration(div18, div16);
			append_hydration(div16, div15);
			append_hydration(div18, t69);
			append_hydration(div18, div17);
			append_hydration(div17, span2);
			append_hydration(span2, t70);
			append_hydration(span2, t71);
			append_hydration(div17, t72);
			append_hydration(div17, span3);
			append_hydration(span3, t73);
			append_hydration(span3, t74);
			append_hydration(div31, t75);
			append_hydration(div31, section4);
			append_hydration(section4, h23);
			append_hydration(h23, t76);
			append_hydration(section4, t77);
			append_hydration(section4, div25);
			append_hydration(div25, div20);
			append_hydration(div20, img2);
			append_hydration(div25, t78);
			append_hydration(div25, div24);
			append_hydration(div24, p13);
			append_hydration(p13, t79);
			append_hydration(div24, t80);
			append_hydration(div24, p14);
			append_hydration(p14, t81);
			append_hydration(div24, t82);
			append_hydration(div24, h35);
			append_hydration(h35, t83);
			append_hydration(div24, t84);
			append_hydration(div24, p15);
			append_hydration(p15, t85);
			append_hydration(div24, t86);
			append_hydration(div24, ul2);
			append_hydration(ul2, li5);
			append_hydration(li5, t87);
			append_hydration(ul2, t88);
			append_hydration(ul2, li6);
			append_hydration(li6, t89);
			append_hydration(ul2, t90);
			append_hydration(ul2, li7);
			append_hydration(li7, t91);
			append_hydration(ul2, t92);
			append_hydration(ul2, li8);
			append_hydration(li8, t93);
			append_hydration(div24, t94);
			append_hydration(div24, p16);
			append_hydration(p16, t95);
			append_hydration(div24, t96);
			append_hydration(div24, div22);
			append_hydration(div22, div21);
			append_hydration(div24, t97);
			append_hydration(div24, div23);
			append_hydration(div23, span4);
			append_hydration(span4, t98);
			append_hydration(span4, t99);
			append_hydration(div23, t100);
			append_hydration(div23, span5);
			append_hydration(span5, t101);
			append_hydration(span5, t102);
			append_hydration(div31, t103);
			append_hydration(div31, section5);
			append_hydration(section5, h24);
			append_hydration(h24, t104);
			append_hydration(section5, t105);
			append_hydration(section5, p17);
			append_hydration(p17, t106);
			append_hydration(section5, t107);
			append_hydration(section5, div29);
			append_hydration(div29, div26);
			append_hydration(div26, h36);
			append_hydration(h36, t108);
			append_hydration(div26, t109);
			append_hydration(div26, p18);
			append_hydration(p18, t110);
			append_hydration(div26, t111);
			append_hydration(div26, form0);
			append_hydration(form0, input0);
			append_hydration(form0, t112);
			append_hydration(form0, input1);
			append_hydration(form0, t113);
			append_hydration(form0, input2);
			append_hydration(form0, t114);
			append_hydration(form0, button0);
			append_hydration(button0, t115);
			append_hydration(div29, t116);
			append_hydration(div29, div27);
			append_hydration(div27, h37);
			append_hydration(h37, t117);
			append_hydration(div27, t118);
			append_hydration(div27, p19);
			append_hydration(p19, t119);
			append_hydration(div27, t120);
			append_hydration(div27, form1);
			append_hydration(form1, input3);
			append_hydration(form1, t121);
			append_hydration(form1, input4);
			append_hydration(form1, t122);
			append_hydration(form1, input5);
			append_hydration(form1, t123);
			append_hydration(form1, button1);
			append_hydration(button1, t124);
			append_hydration(div29, t125);
			append_hydration(div29, div28);
			append_hydration(div28, h38);
			append_hydration(h38, t126);
			append_hydration(div28, t127);
			append_hydration(div28, p20);
			append_hydration(p20, t128);
			append_hydration(div28, t129);
			append_hydration(div28, form2);
			append_hydration(form2, input6);
			append_hydration(form2, t130);
			append_hydration(form2, input7);
			append_hydration(form2, t131);
			append_hydration(form2, input8);
			append_hydration(form2, t132);
			append_hydration(form2, button2);
			append_hydration(button2, t133);
			append_hydration(section5, t134);
			append_hydration(section5, div30);
			append_hydration(div30, h39);
			append_hydration(h39, t135);
			append_hydration(div30, t136);
			append_hydration(div30, p21);
			append_hydration(p21, t137);
			append_hydration(div31, t138);
			append_hydration(div31, section6);
			append_hydration(section6, h25);
			append_hydration(h25, t139);
			append_hydration(section6, t140);
			append_hydration(section6, p22);
			append_hydration(p22, t141);
			append_hydration(section6, t142);
			append_hydration(section6, button3);
			append_hydration(button3, t143);
			append_hydration(section6, t144);
			append_hydration(section6, p23);
			append_hydration(p23, t145);
			append_hydration(p23, a);
			append_hydration(a, t146);

			if (!mounted) {
				dispose = listen(button3, "click", /*openWhatsApp*/ ctx[6]);
				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*image*/ 1 && !src_url_equal(img0.src, img0_src_value = /*image*/ ctx[0].url)) {
				attr(img0, "src", img0_src_value);
			}

			if (dirty & /*image*/ 1 && img0_alt_value !== (img0_alt_value = /*image*/ ctx[0].alt)) {
				attr(img0, "alt", img0_alt_value);
			}

			if (dirty & /*contents*/ 2 && raw_value !== (raw_value = /*contents*/ ctx[1].html + "")) div1.innerHTML = raw_value;
			if (dirty & /*expenses*/ 128) {
				each_value_1 = /*expenses*/ ctx[7];
				let i;

				for (i = 0; i < each_value_1.length; i += 1) {
					const child_ctx = get_each_context_1(ctx, each_value_1, i);

					if (each_blocks_1[i]) {
						each_blocks_1[i].p(child_ctx, dirty);
					} else {
						each_blocks_1[i] = create_each_block_1(child_ctx);
						each_blocks_1[i].c();
						each_blocks_1[i].m(div7, null);
					}
				}

				for (; i < each_blocks_1.length; i += 1) {
					each_blocks_1[i].d(1);
				}

				each_blocks_1.length = each_value_1.length;
			}

			if (dirty & /*expenses*/ 128) {
				each_value = /*expenses*/ ctx[7];
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(div8, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(main);
			destroy_each(each_blocks_1, detaching);
			destroy_each(each_blocks, detaching);
			mounted = false;
			dispose();
		}
	};
}

let monthlyGoal = 15000;
let cushionsGoal = 2000;
let libraryGoal = 7500;

// For demonstration purposes - these would be updated with actual values
let monthlyRaised = 5000;

let cushionsRaised = 800;
let libraryRaised = 2500;
const func = (sum, e) => sum + e.percentage;
const func_1 = (sum, e) => sum + e.percentage;

function instance($$self, $$props, $$invalidate) {
	let { props } = $$props;
	let { image } = $$props;
	let { contents } = $$props;

	// Calculate percentages
	let monthlyPercentage = monthlyRaised / monthlyGoal * 100;

	let cushionsPercentage = cushionsRaised / cushionsGoal * 100;
	let libraryPercentage = libraryRaised / libraryGoal * 100;

	// Format currency
	const formatCurrency = amount => {
		return new Intl.NumberFormat('en-EG',
		{
				style: 'currency',
				currency: 'EGP',
				minimumFractionDigits: 0
			}).format(amount);
	};

	// WhatsApp contact function
	const openWhatsApp = () => {
		const message = encodeURIComponent("Hello, I'd like to know more about supporting Bab Initiative.");
		window.open(`https://wa.me/+201234567890?text=${message}`, '_blank');
	};

	// Monthly expenses breakdown for pie chart (placeholder data)
	const expenses = [
		{ category: 'Rent', percentage: 60 },
		{ category: 'Utilities', percentage: 15 },
		{
			category: 'Administration',
			percentage: 10
		},
		{
			category: 'Supplies & Maintenance',
			percentage: 15
		}
	];

	$$self.$$set = $$props => {
		if ('props' in $$props) $$invalidate(8, props = $$props.props);
		if ('image' in $$props) $$invalidate(0, image = $$props.image);
		if ('contents' in $$props) $$invalidate(1, contents = $$props.contents);
	};

	return [
		image,
		contents,
		monthlyPercentage,
		cushionsPercentage,
		libraryPercentage,
		formatCurrency,
		openWhatsApp,
		expenses,
		props
	];
}

class Component extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, { props: 8, image: 0, contents: 1 });
	}
}

export { Component as default };
