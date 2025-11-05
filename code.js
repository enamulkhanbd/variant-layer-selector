// Store the node the user originally selected (must be a COMPONENT or COMPONENT_SET)
let originalSelection = null;

// --- *** THE FIX IS HERE *** ---
// Show the UI
// Removed the 'resizable' property that was causing the error.
figma.showUI(__html__, { 
  width: 340, 
  height: 480, 
  title: "Variant Layer Selector" 
});
// --- *** END FIX *** ---


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
  // Instance logic has been removed
  return null;
}

// --- **FIXED: getLayers function** ---
// This function now generates a structural path (e.g., "0/1/2/")
// based on child indices, which is truly unique.
function getLayers(node) {
  let layerList = [];

  // `namePrefix` is the human-readable path (e.g., "Header/Icon/")
  // `indexPath` is the unique structural path (e.g., "0/1/")
  function traverse(childNode, namePrefix, indexPath) {
    const displayName = namePrefix + childNode.name;
    const structuralPath = indexPath; // This path is unique

    // We push the display name, the ID, and the unique path
    layerList.push({ name: displayName, id: childNode.id, path: structuralPath });
    
    if ('children' in childNode) {
      childNode.children.forEach((grandChild, index) => {
        // Recurse, appending the current name and index to the paths
        traverse(grandChild, displayName + '/', structuralPath + index + '/');
      });
    }
  }

  if ('children' in node) {
    node.children.forEach((child, index) => {
      // Start the traversal with the top-level children
      traverse(child, '', index + '/');
    });
  }
  return layerList;
}

// --- **FIXED: processSelection Function** ---
async function processSelection() {
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) {
    figma.ui.postMessage({ type: 'no-selection', message: 'Please select a main component or component set.' });
    originalSelection = null;
    return;
  }

  let targetNode = selection[0]; // <-- Use a temporary variable

  // --- *** MODIFIED: Support for FRAME, GROUP, and SECTION selections *** ---
  // If the user selected a container, try to find the first
  // valid component descendant to act as the selection context.
  if (targetNode.type === 'FRAME' || targetNode.type === 'GROUP' || targetNode.type === 'SECTION') {
    // Only look for main components, not instances
    const validDescendant = targetNode.findOne(n => 
      n.type === 'COMPONENT'
    );
    
    if (validDescendant) {
      targetNode = validDescendant; // Re-assign the target for processing
    } else {
      // No valid node found inside the container
      figma.ui.postMessage({ type: 'no-selection', message: 'Selected frame/group/section does not contain a main component.' });
      originalSelection = null;
      return;
    }
  }
  // --- *** END MODIFIED LOGIC *** ---

  originalSelection = targetNode; // Store the node we're *actually* processing
  const componentSet = await findComponentSet(originalSelection); // Pass it to findComponentSet

  if (!componentSet) {
    // This message now correctly handles all non-component/set selections (like instances)
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

      // --- **FIXED: layerMap logic** ---
      // The Map will now use the unique `layer.path` as its key,
      const layerMap = new Map();
      for (const variant of matchingVariants) {
        const layers = getLayers(variant);
        for (const layer of layers) {
          const key = layer.path; // Use the unique structural path
          
          if (!layerMap.has(key)) {
            // We store the human-readable name for display,
            // AND the unique path itself for tree-building in the UI
            layerMap.set(key, { name: layer.name, path: layer.path, nodeIds: [] });
          }
          // Group all node IDs that share this *exact* structural path
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

// Listen for messages coming *from* the UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'select-layers') {
    // This check is still useful in case the user selection was cleared
    // after the UI was populated.
    if (!originalSelection) {
      figma.notify('Your selection has changed. Please re-select a component.', { error: true });
      return;
    }

    const nodesToSelect = [];

    // Instance-finding logic has been removed.
    // We now *only* select the layers from the main component(s)
    // using the IDs sent from the UI.
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