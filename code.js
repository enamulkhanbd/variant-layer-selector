// Store the node the user originally selected (must be a COMPONENT or COMPONENT_SET)
let originalSelection = null;

// Show the UI
figma.showUI(__html__, { 
  width: 340, 
  height: 480, 
  title: "Variant Layer Selector" 
});

// --- Helper Functions ---

async function findComponentSet(node) {
  if (!node) return null;

  if (node.type === 'COMPONENT_SET') {
    return node;
  }

  if (node.type === 'COMPONENT' && node.parent && node.parent.type === 'COMPONENT_SET') {
    return node.parent;
  }

  if (node.type === 'COMPONENT') {
    return node;
  }

  return null;
}

function getLayers(node) {
  const layerList = [];

  function traverse(childNode, namePrefix, indexPath) {
    const displayName = namePrefix + childNode.name;
    const structuralPath = indexPath;

    layerList.push({ name: displayName, id: childNode.id, path: structuralPath });

    if ('children' in childNode && childNode.children.length) {
      childNode.children.forEach((grandChild, index) => {
        traverse(grandChild, displayName + '/', structuralPath + index + '/');
      });
    }
  }

  if ('children' in node && node.children.length) {
    node.children.forEach((child, index) => {
      traverse(child, '', index + '/');
    });
  }
  return layerList;
}

function buildGroupsForSingleComponent(componentNode) {
  const layers = getLayers(componentNode);
  const layerMap = new Map();

  for (const layer of layers) {
    const key = layer.path;
    if (!layerMap.has(key)) {
      layerMap.set(key, { name: layer.name, path: layer.path, nodeIds: [] });
    }
    layerMap.get(key).nodeIds.push(layer.id);
  }

  return [
    {
      propertyName: 'Component Layers',
      options: [
        {
          value: componentNode.name || 'Component',
          uniqueLayers: Array.from(layerMap.values())
        }
      ]
    }
  ];
}

// --- Main selection processing ---

async function processSelection() {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    figma.ui.postMessage({ type: 'no-selection', message: 'Please select a component, component set, or instance.' });
    originalSelection = null;
    return;
  }

  let targetNode = selection[0];

  // Handle instance
  if (targetNode.type === 'INSTANCE') {
    if (targetNode.mainComponent) {
      targetNode = targetNode.mainComponent;
    } else {
      figma.ui.postMessage({ type: 'no-selection', message: 'Selected instance has no main component.' });
      originalSelection = null;
      return;
    }
  }

  // Handle container selection
  if (['FRAME', 'GROUP', 'SECTION'].includes(targetNode.type)) {
    const validDescendant = targetNode.findOne(n => n.type === 'COMPONENT' || n.type === 'INSTANCE');
    if (validDescendant) {
      targetNode = validDescendant.type === 'INSTANCE' && validDescendant.mainComponent
        ? validDescendant.mainComponent
        : validDescendant;
    } else {
      figma.ui.postMessage({ type: 'no-selection', message: 'Selected container has no component inside.' });
      originalSelection = null;
      return;
    }
  }

  originalSelection = targetNode;

  const componentOrSet = await findComponentSet(originalSelection);

  if (!componentOrSet) {
    figma.ui.postMessage({ type: 'no-selection', message: 'Selected node is not a component or component set.' });
    originalSelection = null;
    return;
  }

  // Handle single component
  if (componentOrSet.type === 'COMPONENT') {
    const groupsData = buildGroupsForSingleComponent(componentOrSet);
    figma.ui.postMessage({ type: 'load-groups', data: groupsData });
    return;
  }

  // Handle component set (variants)
  const definitions = componentOrSet.componentPropertyDefinitions || {};
  const variants = componentOrSet.children.filter(n => n.type === 'COMPONENT');
  const groupsData = [];

  for (const propName in definitions) {
    const propDefinition = definitions[propName];

    let options = [];
    if (propDefinition.type === 'VARIANT') {
      options = propDefinition.variantOptions;
    } else if (propDefinition.type === 'BOOLEAN') {
      options = ['True', 'False'];
    } else {
      continue;
    }

    const propertyGroup = {
      propertyName: propName,
      options: []
    };

    for (const optionValue of options) {
      const propertyMatcher = `${propName}=${optionValue}`;
      const matchingVariants = variants.filter(v =>
        v.name.split(', ').includes(propertyMatcher)
      );

      if (matchingVariants.length === 0) continue;

      const layerMap = new Map();
      for (const variant of matchingVariants) {
        const layers = getLayers(variant);
        for (const layer of layers) {
          const key = layer.path;
          if (!layerMap.has(key)) {
            layerMap.set(key, { name: layer.name, path: layer.path, nodeIds: [] });
          }
          layerMap.get(key).nodeIds.push(layer.id);
        }
      }

      propertyGroup.options.push({
        value: optionValue,
        uniqueLayers: Array.from(layerMap.values())
      });
    }

    if (propertyGroup.options.length > 0) {
      groupsData.push(propertyGroup);
    }
  }

  figma.ui.postMessage({ type: 'load-groups', data: groupsData });
}

// --- Plugin Event Listeners ---
processSelection();
figma.on('selectionchange', processSelection);

// --- Handle messages from the UI ---
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'select-layers') {
    if (!originalSelection) {
      figma.notify('Your selection has changed. Please re-select a component.', { error: true });
      return;
    }

    const nodesToSelect = new Set();

    for (const id of msg.ids) {
      try {
        const node = await figma.getNodeByIdAsync(id);
        if (node) {
          nodesToSelect.add(node);
          // ✅ NEW FEATURE: Auto-select parent layers up the hierarchy
          let parent = node.parent;
          while (parent && parent.type !== 'PAGE') {
            nodesToSelect.add(parent);
            parent = parent.parent;
          }
        }
      } catch (err) {
        // skip invalid nodes
      }
    }

    const uniqueNodes = Array.from(nodesToSelect);

    figma.currentPage.selection = uniqueNodes;

    if (uniqueNodes.length > 0) {
      figma.viewport.scrollAndZoomIntoView(uniqueNodes);
    }

    figma.notify(`Selected ${uniqueNodes.length} layer${uniqueNodes.length > 1 ? 's' : ''} (including parents).`);
  }
};
