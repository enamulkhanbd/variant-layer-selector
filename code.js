// Store the node the user originally selected (must be a COMPONENT or COMPONENT_SET)
let originalSelection = null;

const CONTAINER_TYPES = new Set(['FRAME', 'GROUP', 'SECTION']);

// Show the UI
figma.showUI(__html__, { 
  width: 680, 
  height: 480, 
  title: "Variant Layer Selector" 
});

// --- Helper Functions ---

async function findComponentSet(node) {
  if (!node) return null;
  if (node.type === 'COMPONENT_SET') {
    return node;
  }
  // Only find component sets if a main component is selected
  if (node.type === 'COMPONENT' && node.parent.type === 'COMPONENT_SET') {
    return node.parent;
  }
  return null;
}

// This function generates a structural path (e.g., "0/1/2/")
// based on child indices, which is truly unique.
function getLayers(node) {
  let layerList = [];

  // `namePrefix` is the human-readable path (e.g., "Header/Icon/")
  // `indexPath` is the unique structural path (e.g., "0/1/")
  function traverse(childNode, namePrefix, indexPath) {
    const displayName = namePrefix + childNode.name;
    const structuralPath = indexPath;

    layerList.push({ name: displayName, id: childNode.id, path: structuralPath });
    
    if ('children' in childNode) {
      childNode.children.forEach((grandChild, index) => {
        traverse(grandChild, displayName + '/', structuralPath + index + '/');
      });
    }
  }

  if ('children' in node) {
    node.children.forEach((child, index) => {
      traverse(child, '', index + '/');
    });
  }
  return layerList;
}

async function processSelection() {
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) {
    figma.ui.postMessage({ type: 'no-selection', message: 'Please select a component set, component, frame, group, or section.' });
    originalSelection = null;
    return;
  }

  const targetNode = selection[0];

  if (CONTAINER_TYPES.has(targetNode.type)) {
    originalSelection = targetNode;
    const layers = getLayers(targetNode).map(layer => ({
      name: layer.name,
      path: layer.path,
      nodeIds: [layer.id]
    }));

    figma.ui.postMessage({
      type: 'load-node-layers',
      data: {
        containerName: targetNode.name,
        containerType: targetNode.type,
        layers
      }
    });

    return;
  }

  originalSelection = targetNode;
  const componentSet = await findComponentSet(originalSelection);

  if (!componentSet) {
    figma.ui.postMessage({ type: 'no-selection', message: 'Selected node is not part of a component set.' });
    originalSelection = null;
    return;
  }

  const definitions = componentSet.componentPropertyDefinitions;
  const variants = componentSet.children.filter(n => n.type === 'COMPONENT');
  const groupsData = [];

  for (const propName in definitions) {
    const propDefinition = definitions[propName];
    
    let options = [];
    if (propDefinition.type === 'VARIANT') {
      options = propDefinition.variantOptions;
    } else if (propDefinition.type === 'BOOLEAN') {
      options = ["True", "False"];
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

      if (matchingVariants.length === 0) {
        continue;
      }

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

// Run the selection processor once when the plugin first loads
processSelection();

// Re-run the selection processor every time the user changes their selection
figma.on('selectionchange', processSelection);

// Listen for messages coming from the UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'ui-resize') {
    const w = typeof msg.width === 'number' ? msg.width : 420;
    const h = typeof msg.height === 'number' ? msg.height : 480;
    try {
      figma.ui.resize(Math.round(w), Math.round(h));
    } catch (e) {
      // Swallow resize errors silently to avoid interrupting drag
    }
    return;
  }

  if (msg.type === 'select-layers') {
    if (!originalSelection) {
      figma.notify('Your selection has changed. Please re-select a component.', { error: true });
      return;
    }

    const nodesToSelect = [];

    for (const id of msg.ids) {
      const mainLayer = await figma.getNodeByIdAsync(id);
      if (mainLayer) {
        nodesToSelect.push(mainLayer);
      }
    }
    
    // De-duplicate nodes
    const uniqueNodes = Array.from(new Set(nodesToSelect));

    figma.currentPage.selection = uniqueNodes;
    
    if (uniqueNodes.length > 0) {
      figma.viewport.scrollAndZoomIntoView(uniqueNodes);
    }
    
    figma.notify(`Selected ${uniqueNodes.length} layers.`);
  }
};
