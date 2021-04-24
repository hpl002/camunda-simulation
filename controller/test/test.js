const { Event, PendingEvents, Worker, ModelReader } = require('../src/helper')
var chai = require('chai');
var assert = chai.assert;

const data = {
    "pendingEvents": {
        "1618427730000": [
            {
                "priority": -1,
                "description": "description yo",
                "order": 9
            },
            {
                "priority": -1,
                "description": "description yo",
                "order": 8
            },
            {
                "priority": -1,
                "description": "description yo",
                "order": 7
            },
            {
                "priority": -1,
                "description": "description yo",
                "order": 6
            },
            {
                "priority": -1,
                "description": "description yo",
                "order": 5
            },
            {
                "priority": -1,
                "description": "description yo",
                "order": 4
            },
            {
                "priority": -1,
                "description": "description yo",
                "order": 3
            },
            {
                "priority": -1,
                "description": "description yo",
                "order": 2
            },
            {
                "priority": -1,
                "description": "description yo",
                "order": 1
            },
            {
                "priority": -1,
                "description": "description yo",
                "order": 0
            }
        ]
    }
}
const xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<bpmn:definitions xmlns:bpmn=\"http://www.omg.org/spec/BPMN/20100524/MODEL\" xmlns:bpmndi=\"http://www.omg.org/spec/BPMN/20100524/DI\" xmlns:dc=\"http://www.omg.org/spec/DD/20100524/DC\" xmlns:camunda=\"http://camunda.org/schema/1.0/bpmn\" xmlns:di=\"http://www.omg.org/spec/DD/20100524/DI\" id=\"Definitions_1viqdmm\" targetNamespace=\"http://bpmn.io/schema/bpmn\" exporter=\"Camunda Modeler\" exporterVersion=\"4.4.0\">\n  <bpmn:process id=\"goToStore2\" name=\"goToStore2\" isExecutable=\"true\">\n    <bpmn:startEvent id=\"StartEvent_1\">\n      <bpmn:outgoing>Flow_0x6li82</bpmn:outgoing>\n    </bpmn:startEvent>\n    <bpmn:sequenceFlow id=\"Flow_0x6li82\" sourceRef=\"StartEvent_1\" targetRef=\"Activity_0p89r7b\" />\n    <bpmn:sequenceFlow id=\"Flow_0rabjuc\" sourceRef=\"Activity_0p89r7b\" targetRef=\"Activity_05y6lof\" />\n    <bpmn:endEvent id=\"Event_02gruhk\">\n      <bpmn:incoming>Flow_1dkl4t1</bpmn:incoming>\n    </bpmn:endEvent>\n    <bpmn:sequenceFlow id=\"Flow_1dkl4t1\" sourceRef=\"Activity_05y6lof\" targetRef=\"Event_02gruhk\" />\n    <bpmn:serviceTask id=\"Activity_0p89r7b\" name=\"Go to store\" camunda:type=\"external\" camunda:topic=\"simulation\">\n      <bpmn:extensionElements>\n        <camunda:inputOutput>\n          <camunda:inputParameter name=\"Input_3to2nl3\" />\n        </camunda:inputOutput>\n        <camunda:properties>\n          <camunda:property name=\"duration\" value=\"10 seconds\" />\n          <camunda:property name=\"waiting \" value=\"321 seconds\" />\n          <camunda:property name=\"warmup \" value=\"10 seconds\" />\n          <camunda:property name=\"cooldown\" value=\"100s\" />\n        </camunda:properties>\n      </bpmn:extensionElements>\n      <bpmn:incoming>Flow_0x6li82</bpmn:incoming>\n      <bpmn:outgoing>Flow_0rabjuc</bpmn:outgoing>\n    </bpmn:serviceTask>\n    <bpmn:serviceTask id=\"Activity_05y6lof\" name=\"Buy milk\" camunda:type=\"external\" camunda:topic=\"simulation\">\n      <bpmn:incoming>Flow_0rabjuc</bpmn:incoming>\n      <bpmn:outgoing>Flow_1dkl4t1</bpmn:outgoing>\n    </bpmn:serviceTask>\n  </bpmn:process>\n  <bpmndi:BPMNDiagram id=\"BPMNDiagram_1\">\n    <bpmndi:BPMNPlane id=\"BPMNPlane_1\" bpmnElement=\"goToStore2\">\n      <bpmndi:BPMNEdge id=\"Flow_0x6li82_di\" bpmnElement=\"Flow_0x6li82\">\n        <di:waypoint x=\"215\" y=\"117\" />\n        <di:waypoint x=\"320\" y=\"117\" />\n      </bpmndi:BPMNEdge>\n      <bpmndi:BPMNEdge id=\"Flow_0rabjuc_di\" bpmnElement=\"Flow_0rabjuc\">\n        <di:waypoint x=\"420\" y=\"117\" />\n        <di:waypoint x=\"530\" y=\"117\" />\n      </bpmndi:BPMNEdge>\n      <bpmndi:BPMNEdge id=\"Flow_1dkl4t1_di\" bpmnElement=\"Flow_1dkl4t1\">\n        <di:waypoint x=\"630\" y=\"117\" />\n        <di:waypoint x=\"742\" y=\"117\" />\n      </bpmndi:BPMNEdge>\n      <bpmndi:BPMNShape id=\"_BPMNShape_StartEvent_2\" bpmnElement=\"StartEvent_1\">\n        <dc:Bounds x=\"179\" y=\"99\" width=\"36\" height=\"36\" />\n      </bpmndi:BPMNShape>\n      <bpmndi:BPMNShape id=\"Event_02gruhk_di\" bpmnElement=\"Event_02gruhk\">\n        <dc:Bounds x=\"742\" y=\"99\" width=\"36\" height=\"36\" />\n      </bpmndi:BPMNShape>\n      <bpmndi:BPMNShape id=\"Activity_1p2f2o9_di\" bpmnElement=\"Activity_0p89r7b\">\n        <dc:Bounds x=\"320\" y=\"77\" width=\"100\" height=\"80\" />\n      </bpmndi:BPMNShape>\n      <bpmndi:BPMNShape id=\"Activity_0ec1lgv_di\" bpmnElement=\"Activity_05y6lof\">\n        <dc:Bounds x=\"530\" y=\"77\" width=\"100\" height=\"80\" />\n      </bpmndi:BPMNShape>\n    </bpmndi:BPMNPlane>\n  </bpmndi:BPMNDiagram>\n</bpmn:definitions>\n"

//TODO: generate list and pop each element (check that corrrect element is popped )

//TODO: check that list is sorted correctly (account for priority and order)

//TODO: check that list is sorted correctly (account for priority and order)

//TODO: get all elements at timepoint

//TODO: pop all element at timepoint



describe('Unit - Helpers', function () {
    describe('Worker', function () {
        it('should parse xml string to js', ()=>{
            const reader = new ModelReader("some key")
            reader.xml = xml;             
            return reader.parseModel().then(result => {
                assert.isEmpty(result, "xml should have been parsed")
              })
        });
    });
});


async function getFoo() {
    return 'foo'
  }
  
  describe('#getFoo', () => {
    it('resolves with foo', () => {
      return getFoo().then(result => {
        assert.equal(result, 'foo')
      })
    })
  })