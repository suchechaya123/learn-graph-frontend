import { CreateNodeFnResponse } from "./GraphManager/hooks/useCreateNode";
import { Text } from "./GraphManager/hooks/types";
import {
  getRequestId,
  pendingActionTypes,
  EditGraph,
} from "./GraphDataContext";
import { CreateEdgeFnResponse } from "./GraphManager/hooks/useCreateEdge";

export function getCreateNodeAction(graph: EditGraph) {
  return (argument: { description: Text }) =>
    new Promise<CreateNodeFnResponse>(async (resolve, reject) => {
      const requestId = getRequestId();
      graph.requestsDispatch({
        type: pendingActionTypes.CREATE_NODE_WITH_TEMP_ID,
        id: requestId,
        data: argument,
      });
      graph.setNodes([...graph.nodes, { ...argument, id: requestId }]);
      try {
        const response = await graph.createNodeInBackend(argument);
        if (!response.data) {
          throw new Error("creating Node didnt return an ID!");
        }
        const nodesWithoutTempNode = graph.nodes.filter(
          (node) => node.id !== requestId
        );
        graph.setNodes([
          ...nodesWithoutTempNode,
          { ...argument, id: response.data.createNode.ID },
        ]);
      } catch (error) {
        // remove temp node before escalating error
        const nodesWithoutTempNode = graph.nodes.filter(
          (node) => node.id !== requestId
        );
        graph.setNodes(nodesWithoutTempNode);

        // TODO: report error to user - notistack?
        // TODO(far future): log error
        reject(error);
      }
      graph.requestsDispatch({
        type: pendingActionTypes.CLEAR_REQUEST,
        id: requestId,
      });
      resolve({ data: { createNode: { ID: "TMPID1" } } }); // TODO(skep): random tmp id's, since there can be multiple
    });
}

export function getCreateLinkAction(graph: EditGraph) {
  return (argument: { from: string; to: string; weight: number }) =>
    new Promise<CreateEdgeFnResponse>(async (resolve, reject) => {
      // check if node exists or id is in requests
      if (
        graph.requests.find(
          ({ type, id }) =>
            (id === argument.from || id === argument.to) &&
            type === pendingActionTypes.CREATE_NODE_WITH_TEMP_ID
        )
      ) {
        // if used node is being created, throw error and abort
        reject(
          new Error(
            "Trying to create a link to a Node that hasn't been created yet!"
          )
        );
        // (TODO(future): await other request to finish, then queue this one? could also be bad if the wait time is long and the user changes their mind in the meantime)
      }
      const requestId = getRequestId();
      graph.requestsDispatch({
        type: pendingActionTypes.CREATE_LINK_WITH_TEMP_ID,
        id: requestId,
        data: argument,
      });
      // insert link into links with tmp id
      graph.setLinks([
        ...graph.links,
        {
          source: argument.from,
          target: argument.to,
          value: argument.weight,
          id: requestId,
        },
      ]);
      try {
        const response = await graph.createLinkInBackend(argument);
        if (!response.data) {
          throw new Error("Creating Link didn't return any data");
        }
        const linksWithoutTempNode = graph.links.filter(
          (node) => node.id !== requestId
        );
        graph.setLinks([
          ...linksWithoutTempNode,
          {
            source: argument.from,
            target: argument.to,
            value: argument.weight,
            id: response.data.createEdge.ID,
          },
        ]);
      } catch (error) {
        graph.setLinks(graph.links.filter((link) => link.id !== requestId));
        reject(error);
      }
      graph.requestsDispatch({
        type: pendingActionTypes.CLEAR_REQUEST,
        id: requestId,
      });
      resolve({ data: { createEdge: { ID: "TMPEDGEID" } } });
    });
}
